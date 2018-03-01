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
    static cast(obj) {
      let snapshot = {
        key: obj.getKey(),
        val: () => obj.getValue()
      };
      return new this(snapshot);
    }
    static castMany(objs) {
      return objs.map(o => this.cast(o));
    }
    toString() {
      return _toString(modelName, this);
    }
    get[Symbol.toStringTag]() {
      return modelName;
    }
    listenForChanges(field, emitCb) {
      let clas = this.constructor;
      super.listenForChanges(field, obj => emitCb(clas.cast(obj)));
    }
    static getByKey(key) {
      return this.cast(super.getByKey(ref, key));
    }
    static getAll() {
      return this.castMany(super.getAll(ref));
    }
    static getAllByKeys(keys) {
      return this.castMany(super.getAllByKeys(ref, keys));
    }
    static getAllByFields(fieldToVal) {
      return this.castMany(super.getAllByFields(ref, fieldToVal));
    }
    static getAllByBounds(fieldToBound) {
      return this.castMany(super.getAllByBounds(ref, fieldToBound));
    }
    static getAllThatStartsWith(field, value) {
      return this.castMany(super.getAllThatStartsWith(ref, value));
    }
    static getKeysExist(keys) {
      return super.getKeysExist(ref, keys);
    }
    static deleteByKey(key) {
      return this.cast(super.deleteByKey(ref, key));
    }
    static updateByKey(key, fieldToVal) {
      return this.cast(super.updateByKey(ref, key, fieldToVal));
    }
    static createByAutoKey(fieldToVal) {
      return this.cast(super.createByAutoKey(ref, fieldToVal));
    }
    static createByManualKey(key, fieldToVal) {
      return this.cast(super.createByManualKey(ref, key, fieldToVal));
    }
    static transaction(key, field, atomicFn) {
      return this.cast(super.transaction(ref, key, atomicFn));
    }
    static transactNum(key, field, delta) {
      return this.cast(super.transactNum(ref, key, field, delta));
    }
    static transactAppendToList(key, field, value, isUniqueList) {
      return this.cast(super
        .transactAppendToList(ref, key, field, value, isUniqueList));
    }
    static transactRemoveFromList(key, field, value, isUniqueList) {
      return this.cast(super
        .transactRemoveFromList(ref, key, field, value, isUniqueList));
    }
    static listenForQuery(field, value, emitCb) {
      super.listenForQuery(ref, field, value, obj => emitCb(this.cast(obj)));
    }
  }
  let props = _getProps(firebase, subSchema);
  return eval(
    `class ${modelName} extends WrapperObject {
      constructor(snapshot) {
        super(snapshot);
        Object.defineProperties(this, props);
      }
    }; ${modelName}`
  );
}

// EXPORTS
module.exports = genClass;
