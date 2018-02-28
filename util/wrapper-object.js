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
    static _cast(that, obj) {
      let snapshot = {
        key: obj.getKey(),
        val: () => obj.getValue()
      };
      return new that(snapshot);
    }
    static _castMany(that, objs) {
      return objs.map(o => that._cast(that, o));
    }
    static _castWrap(p) {
      return p.then(obj => this._cast(this, obj));
    }
    static _castManyWrap(p) {
      return p.then(objs => this._castMany(this, objs));
    }
    toString() {
      return _toString(modelName, this);
    }
    get[Symbol.toStringTag]() {
      return modelName;
    }
    delete() {
      return this.constructor._castWrap(super.delete());
    }
    update(fieldToVal) {
      return this.constructor._castWrap(super.update(fieldToVal));
    }
    listenForChanges(field, emitCb) {
      super.listenForChanges(field, obj => emitCb(this.constructor._cast(
        this, obj)));
    }
    transaction(field, atomicFn) {
      let p = super.transaction(this._ref, field, atomicFn);
      return this.constructor._castWrap(p);
    }
    transactNum(field, delta) {
      let p = super.transactNum(this._ref, field, delta);
      return this.constructor._castWrap(p);
    }
    transactAppendToList(field, value, isUniqueList) {
      let p = super.transactAppendToList(this._ref, field, value,
        isUniqueList);
      return this.constructor._castWrap(p);
    }
    static transactRemoveFromList(field, value, isUniqueList) {
      let p = super.transactRemoveFromList(this._ref, field, value,
        isUniqueList);
      return this.constructor._castWrap(p);
    }
    static getByKey(key) {
      return this._castWrap(super.getByKey(ref, key));
    }
    static getAll() {
      return this._castManyWrap(super.getAll(ref));
    }
    static getAllByKeys(keys) {
      return this._castManyWrap(super.getAllByKeys(ref, keys));
    }
    static getAllByFields(fieldToVal) {
      return this._castManyWrap(super.getAllByFields(ref, fieldToVal));
    }
    static getAllByBounds(fieldToBound) {
      return this._castManyWrap(super.getAllByBounds(ref, fieldToBound));
    }
    static getAllThatStartsWith(field, value) {
      return this._castManyWrap(super.getAllThatStartsWith(ref, value));
    }
    static getKeysExist(keys) {
      return super.getKeysExist(ref, keys);
    }
    static deleteByKey(key) {
      return this._castWrap(super.deleteByKey(ref, key));
    }
    static updateByKey(key, fieldToVal) {
      return this._castWrap(super.updateByKey(ref, key, fieldToVal));
    }
    static createByAutoKey(fieldToVal) {
      return this._castWrap(super.createByAutoKey(ref, fieldToVal));
    }
    static createByManualKey(key, fieldToVal) {
      return this._castWrap(super.createByManualKey(ref, key, fieldToVal));
    }
    static transaction(key, field, atomicFn) {
      return this._castWrap(super.transaction(ref, key, atomicFn));
    }
    static transactNum(key, field, delta) {
      return this._castWrap(super.transactNum(ref, key, field, delta));
    }
    static transactAppendToList(key, field, value, isUniqueList) {
      return this._castWrap(super
        .transactAppendToList(ref, key, field, value, isUniqueList));
    }
    static transactRemoveFromList(key, field, value, isUniqueList) {
      return this._castWrap(super
        .transactRemoveFromList(ref, key, field, value, isUniqueList));
    }
    static listenForQuery(field, value, emitCb) {
      super.listenForQuery(ref, field, value, obj => emitCb(this._cast(this,
        obj)));
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
