const genClass = require("./wrapper-object.js");

var exportedModule = (firebase, schema) => {
  const rootRef = firebase.database().ref();
  const classes = {};
  Object.keys(schema).forEach(modelName => {
    let subSchema = schema[modelName];
    let ref = rootRef.child(subSchema.path);
    classes[modelName] = genClass(firebase, modelName, ref, subSchema);
  });
  return classes;
}

/**
 * DB entry point for firebase-admin-util
 * @module db
 */
/**
 * Is an object that has keys for each object class mentioned
 * in your database schema. For example: db.User would represent
 * User object class.
 */
module.exports = exportedModule;
