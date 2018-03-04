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
          get: function() {
            let keys = this._value[field];
            return _genEmptyObjs(ref, keys);
          }
        };
      } else if (type == "string") {
        result[field] = {
          get: function() {
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
      return util.toString(modelName, this);
    }
    get[Symbol.toStringTag]() {
      return modelName;
    }
    listenForChanges(field, emitCb) {
      let clas = this.constructor;
      super.listenForChanges(field, obj => emitCb(clas.cast(obj)));
    }
    static async getByKey(key) {
      let obj = await super.getByKey(ref, key);
      return this.cast(obj);
    }
    static async getAll() {
      let objs = await super.getAll(ref);
      return this.castMany(objs);
    }
    static async getAllByKeys(keys) {
      let objs = await super.getAllByKeys(ref, keys);
      return this.castMany(objs);
    }
    static async getAllByFields(fieldToVal) {
      let objs = await super.getAllByFields(ref, fieldToVal);
      return this.castMany(objs);
    }
    static async getAllByBounds(fieldToBound) {
      let objs = await super.getAllByBounds(ref, fieldToBound);
      return this.castMany(async);
    }
    static async getAllThatStartsWith(field, value) {
      let objs = await super.getAllThatStartsWith(ref, value);
      return this.castMany(objs);
    }
    static async getKeysExist(keys) {
      return await super.getKeysExist(ref, keys);
    }
    static async deleteByKey(key) {
      let obj = await super.deleteByKey(ref, key);
      return this.cast(obj);
    }
    static async updateByKey(key, fieldToVal) {
      let obj = await super.updateByKey(ref, key, fieldToVal);
      return this.cast(obj);
    }
    static async createByAutoKey(fieldToVal) {
      let obj = await super.createByAutoKey(ref, fieldToVal);
      return this.cast(obj);
    }
    static async createByManualKey(key, fieldToVal) {
      let obj = await super.createByManualKey(ref, key, fieldToVal);
      return this.cast(obj);
    }
    static async transaction(key, field, atomicFn) {
      let obj = await super.transaction(ref, key, atomicFn);
      return this.cast(obj);
    }
    static async transactNum(key, field, delta) {
      let obj = await super.transactNum(ref, key, field, delta);
      return this.cast(obj);
    }
    static async transactAppendToList(key, field, value, isUniqueList) {
      let obj = await super
        .transactAppendToList(ref, key, field, value, isUniqueList);
      return this.cast(obj);
    }
    static async transactRemoveFromList(key, field, value, isUniqueList) {
      let obj = await super
        .transactRemoveFromList(ref, key, field, value, isUniqueList);
      return this.cast(obj);
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
