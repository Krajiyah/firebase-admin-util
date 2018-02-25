// DEPENDENCIES
const util = require("./util.js");
const FirebaseObject = require("./object.js");

// HELPERS
let _genEmptyObjCb = (ref, key) => {
  return () => {
    var o = new FirebaseObject(ref, null);
    o._synced = false;
    o._key = key;
    return o;
  }
}

let _genEmptyObjsCb = (ref, keys) => {
  return () => keys.map(key => _genEmptyObjCb(ref, key)());
}

let _getProps = (firebase, subSchema) => {
  const rootRef = firebase.database().ref();
  var result = {};
  Object.keys(subSchema.fields).forEach(field => {
    let fieldType = subSchema.fields[field];
    if (fieldType.indexOf(":") >= 0) {
      let x = fieldType.split(":");
      let type = x[0];
      let ref = rootRef.child(x[1]);
      if (type == "array") {
        result[field] = {
          get: _genEmptyObjsCb(ref, this._value[field])
        };
      } else if (type == "string") {
        result[field] = {
          get: _genEmptyObjCb(ref, this._value[field])
        };
      }
    } else {
      result[field] = {
        get: function() {
          return this._value[field];
        },
        set: function(x) {
          this._value[field] = x;
          this._synced = false;
        }
      };
    }
  });
  return result;
}

// METHODS
var genClass = (firebase, modelName, ref, subSchema) => {
  class WrapperObject extends FirebaseObject {
    constructor(snapshot) {
      super(ref, snapshot);
    }
    static _cast(obj) {
      let snapshot = {
        key: obj.getKey(),
        val: () => obj.getValue()
      };
      return new WrapperObject(snapshot);
    }
    static _castMany(objs) {
      return objs.map(o => WrapperObject._cast(o));
    }
    toString() {
      return _toString(modelName, this);
    }
    get[Symbol.toStringTag]() {
      return modelName;
    }
    delete() {
      return super().then(WrapperObject._cast);
    }
    update(fieldToVal) {
      super(fieldToVal).then(WrapperObject._cast);
    }
    listenForChanges(field, emitCb) {
      super(field, obj => emitCb(WrapperObject._cast(obj)));
    }
    static getByKey(key) {
      return super(ref, key).then(WrapperObject._cast);
    }
    static getAll() {
      return super(ref).then(WrapperObject._castMany);
    }
    static getAllByKeys(keys) {
      return super(ref, keys).then(WrapperObject._castMany);
    }
    static getAllByFields(fieldToVal) {
      return super(ref, fieldToVal).then(WrapperObject._castMany);
    }
    static getAllByBounds(fieldToBound) {
      return super(ref, fieldToBound).then(WrapperObject._castMany);
    }
    static getAllThatStartsWith(field, value) {
      return super(ref, value).then(WrapperObject._castMany);
    }
    static getKeysExist(keys) {
      return super(ref, keys);
    }
    static deleteByKey(key) {
      return super(ref, key).then(WrapperObject._cast);
    }
    static updateByKey(key, fieldToVal) {
      return super(ref, key, fieldToVal).then(WrapperObject._cast);
    }
    static createByAutoKey(fieldToVal) {
      return super(ref, fieldToVal).then(WrapperObject._cast);
    }
    static createByManualKey(key, fieldToVal) {
      return super(ref, key, fieldToVal).then(WrapperObject._cast);
    }
    static transaction(key, field, atomicFn) {
      return super(ref, key, atomicFn).then(WrapperObject._cast);
    }
    static transactNum(key, field, delta) {
      return super(ref, key, field, delta).then(WrapperObject._cast);
    }
    static transactAppendToList(key, field, value, isUniqueList) {
      return super(ref, key, field, value, isUniqueList)
        .then(WrapperObject._cast);
    }
    static transactRemoveFromList(key, field, value, isUniqueList) {
      return super(ref, key, field, value, isUniqueList)
        .then(WrapperObject._cast);
    }
    static listenForQuery(field, value, emitCb) {
      super(ref, field, value, obj => emitCb(WrapperObject._cast(obj)));
    }
  }
  let clas = eval(
    `class ${modelName} extends WrapperObject {}; ${modelName}`
  );
  let props = _getProps(firebase, subSchema);
  Object.defineProperties(clas, props);
  return clas;
}

// EXPORTS
module.exports = genClass;
