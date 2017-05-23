var express = require('express');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var url = require('url');
var admin = require("firebase-admin");

var serviceAccount = JSON.parse(process.env.KEYFILE);
var projectId = process.env.PROJECT_ID;
var parserLimit = process.env.PARSER_LIMIT || '1000kb';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://" + projectId + ".firebaseio.com"
});

// we need to encode and decode the type of the value we use as since marker
var encode = function (since) {
  if (typeof since === "number") {
    return "n:" + since;
  } else {
    return "s:" + since;
  }
};

var decode = function (since) {
  if (since == undefined) {
    return since;
  }
  if (since.startsWith("n:")) {
    return parseFloat(since.substr(2));
  } else {
    return since.substr(2);
  }
};

var app = express();

app.use(bodyParser.json({limit: parserLimit}));
app.use(morgan('tiny'));

app.get(/.*/, function (request, response) {
  var parsedUrl = url.parse(request.url, true);
  var query = parsedUrl.query;
  var updatedPath = query.since_path;
  var updated = decode(query.since);
  var path = parsedUrl.pathname;
  var ref = admin.database().ref(path);
  if (updatedPath && updated) {
    ref = ref.orderByChild(updatedPath).startAt(updated);
  }
  ref.once("value", function (snapshot) {
    var counter = 0;
    response.writeHead(200, { "Content-Type": "application/json" });
    response.write("[");
    var entities = snapshot.forEach(function (data) {
      var val = data.val();
      var since = val[updatedPath];
      // drop entities that has exact since value, startAt is fixed to greater than or equal
      if (updatedPath && updated == since) {
        return;
      }
      var entity = { "_id": data.key };
      if (since) {
        entity["_updated"] = encode(since);
      }
      Object.assign(entity, val);
      if (counter == 0){
        response.write(JSON.stringify(entity));
        counter++;
      }
      else {
        response.write("," + JSON.stringify(entity) );
      }
    });
    response.write("]");
    response.end();
  });
});

app.post(/.*/, function (request, response) {
  var parsedUrl = url.parse(request.url, true);
  var path = parsedUrl.pathname;
  var ref = admin.database().ref(path);
  var entities = request.body;
  // might get one entity or a list
  var entities = [].concat(entities);

  if (entities.length == 0) {
    response.send("Done!");
  }

  var notCompleted = entities.length;
  var errors = [];
  var completionHandler = function (entity, error) {
    notCompleted--;
    if (error) {
      errors.push(error);
      console.error("Failed to handle", entity, error);
    }
    if (notCompleted == 0) {
      if (errors.length > 0) {
        response.status(500).send('Oops, something went wrong, check server log!');
      } else {
        response.send("Done!");
      }
    } else {
      // nice to get some progress when handling huge number of entities
      if (notCompleted % 10000 == 0) {
        console.log("Waiting for " + notCompleted + " to finish");
      }
    }
  };

  entities.forEach(function (entity) {
    var id = entity["_id"];
    var filtered;
    if (entity["_deleted"] && entity["_deleted"] === true) {
      filtered = null;
    } else {
      filtered = {};
      Object.keys(entity).filter(function (k) {
        return !k.startsWith("_")
      }).forEach(function (k) {
        filtered[k] = entity[k];
      });
    }
    ref.child(id).set(filtered, function(error) { completionHandler(entity, error) });
  });
});

app.listen(5000, "0.0.0.0", function () {
  console.log("Server running at http://0.0.0.0:5000/");
});

