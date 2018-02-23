// DEPENDENCIES
const util = require("./util.js");
const FirebaseObject = require("./object.js");

// HELPERS
let _cast = (firebaseObject) => {
  let snapshot = {
    key: firebaseObject.getKey(),
    val: () => firebaseObject.getValue()
  };
  return new WrapperObject(snapshot);
}

let _castMany = (firebaseObjects) => {
  return firebaseObjects.map(o => _cast(o));
}

// METHODS
var genClass = (modelName, ref, subSchema) => {
  class WrapperObject extends FirebaseObject {
    constructor(snapshot) {
      super(ref, snapshot);
    }
    toString() {
      return _toString(modelName, this);
    }
    get[Symbol.toStringTag]() {
      return modelName;
    }
    delete() {
      return super().then(_cast);
    }
    update(fieldToVal) {
      // TODO: validate fields with subSchema
      super(fieldToVal).then(_cast);
    }
    listenForChanges(field, emitCb) {
      // TODO: validate field with subSchema
      super(field, obj => emitCb(_cast(obj)));
    }
    static getByKey(key) {
      return super(ref, key).then(_cast);
    }
    static getAll() {
      return super(ref).then(_castMany);
    }
    static getAllByKeys(keys) {
      return super(ref, keys).then(_castMany);
    }
    static getAllByFields(fieldToVal) {
      // TODO: validate fields with subSchema
      return super(ref, fieldToVal).then(_castMany);
    }
    static getAllByBounds(fieldToBound) {
      // TODO: validate fields with subSchema
      return super(ref, fieldToBound).then(_castMany);
    }
    static getAllThatStartsWith(field, value) {
      // TODO: validate field with subSchema
      return super(ref, value).then(_castMany);
    }
    static getKeysExist(keys) {
      return super(ref, keys);
    }
    static deleteByKey(key) {
      return super(ref, key).then(_cast);
    }
    static updateByKey(key, fieldToVal) {
      // TODO: validate fields with subSchema
      return super(ref, key, fieldToVal).then(_cast);
    }
    static createByAutoKey(fieldToVal) {
      // TODO: validate fields with subSchema
      return super(ref, fieldToVal).then(_cast);
    }
    static createByManualKey(key, fieldToVal) {
      // TODO: validate fields with subSchema
      return super(ref, key, fieldToVal).then(_cast);
    }
    static transaction(key, field, atomicFn) {
      // TODO: validate field with subSchema
      return super(ref, key, atomicFn).then(_cast);
    }
    static transactNum(key, field, delta) {
      // TODO: validate field with subSchema
      return super(ref, key, field, delta).then(_cast);
    }
    static transactAppendToList(key, field, value, isUniqueList) {
      // TODO: validate field with subSchema
      return super(ref, key, field, value, isUniqueList).then(_cast);
    }
    static transactRemoveFromList(key, field, value, isUniqueList) {
      // TODO: validate field with subSchema
      return super(ref, key, field, value, isUniqueList).then(_cast);
    }
    static listenForQuery(field, value, emitCb) {
      // TODO: validate field with subSchema
      super(ref, field, value, obj => emitCb(_cast(obj)));
    }
  }
  return eval(
    `class ${modelName} extends WrapperObject {
		constructor(snapshot) {
			super(snapshot)
		}
	}; WrapperObject`
  );
}

// EXPORTS
module.exports = genClass;
