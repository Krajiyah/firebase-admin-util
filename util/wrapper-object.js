// DEPENDENCIES
const util = require("./util.js");
const FirebaseObject = require("./object.js");

// HELPERS
let _genEmptyObj = (ref, key) => {
  var o = new FirebaseObject(ref, null);
  o._synced = false;
  o._key = key;
  return o;
}

let _genEmptyObjs = (ref, keys) => keys.map(key => _genEmptyObj(ref, key));

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
          get: () => {
            let keys = this._value[field];
            return _genEmptyObjs(ref, keys);
          }
        };
      } else if (type == "string") {
        result[field] = {
          get: () => {
            let key = this._value[field];
            return _genEmptyObj(ref, key);
          }
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
      return new this(snapshot);
    }
    static _castMany(objs) {
      return objs.map(o => this._cast(o));
    }
    toString() {
      return _toString(modelName, this);
    }
    get[Symbol.toStringTag]() {
      return modelName;
    }
    delete() {
      return super.delete().then(this.constructor._cast);
    }
    update(fieldToVal) {
      super.update(fieldToVal).then(this.constructor._cast);
    }
    listenForChanges(field, emitCb) {
      super.listenForChanges(field, obj => {
        return emitCb(this.constructor._cast(obj));
      });
    }
    static getByKey(key) {
      return super.getByKey(ref, key).then(this._cast);
    }
    static getAll() {
      return super.getAll(ref).then(this._castMany);
    }
    static getAllByKeys(keys) {
      return super.getAllByKeys(ref, keys).then(this._castMany);
    }
    static getAllByFields(fieldToVal) {
      return super.getAllByFields(ref, fieldToVal).then(this._castMany);
    }
    static getAllByBounds(fieldToBound) {
      return super.getAllByBounds(ref, fieldToBound).then(this._castMany);
    }
    static getAllThatStartsWith(field, value) {
      return super.getAllThatStartsWith(ref, value).then(this._castMany);
    }
    static getKeysExist(keys) {
      return super.getKeysExist(ref, keys);
    }
    static deleteByKey(key) {
      return super.deleteByKey(ref, key).then(this._cast);
    }
    static updateByKey(key, fieldToVal) {
      return super.updateByKey(ref, key, fieldToVal).then(this._cast);
    }
    static createByAutoKey(fieldToVal) {
      return super.createByAutoKey(ref, fieldToVal).then(this._cast);
    }
    static createByManualKey(key, fieldToVal) {
      return super.createByManualKey(ref, key, fieldToVal)
        .then(this._cast);
    }
    static transaction(key, field, atomicFn) {
      return super.transaction(ref, key, atomicFn).then(this._cast);
    }
    static transactNum(key, field, delta) {
      return super.transactNum(ref, key, field, delta).then(this._cast);
    }
    static transactAppendToList(key, field, value, isUniqueList) {
      return super
        .transactAppendToList(ref, key, field, value, isUniqueList)
        .then(this._cast);
    }
    static transactRemoveFromList(key, field, value, isUniqueList) {
      return super
        .transactRemoveFromList(ref, key, field, value, isUniqueList)
        .then(this._cast);
    }
    static listenForQuery(field, value, emitCb) {
      super.listenForQuery(ref, field, value, obj => {
        return emitCb(this._cast(obj))
      });
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
