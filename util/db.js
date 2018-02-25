// DEPENDENCIES
const genClass = require("./wrapper-object.js");

// METHODS
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

// EXPORTS
module.exports = exportedModule;
