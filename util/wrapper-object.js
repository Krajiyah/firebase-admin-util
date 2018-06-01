const util = require("./util.js");
const FirebaseObject = require("./object.js");

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
          /**
           * Property getter for array of objects field listed in schema
           * @memberof WrapperObject
           * @inner
           * @function get
           * @returns {Array<FirebaseObject>}
           */
          get: function() {
            let keys = this._value[field];
            return _genEmptyObjs(ref, keys);
          }
        };
      } else if (type == "string") {
        result[field] = {
          /**
           * Property getter for object field listed in schema
           * @memberof WrapperObject
           * @inner
           * @function get
           * @returns {FirebaseObject}
           */
          get: function() {
            let key = this._value[field];
            return _genEmptyObj(ref, key);
          }
        };
      }
    } else {
      result[field] = {
        /**
         * Property getter for non-object field listed in schema
         * @memberof WrapperObject
         * @inner
         * @function get
         * @returns {any} type is specified in schema
         */
        get: function() {
          return this._value[field];
        },

        /**
         * Property setter (locally) for non-object field listed in schema (unsyncs object)
         * @memberof WrapperObject
         * @inner
         * @function set
         */
        set: function(x) {
          this._value[field] = x;
          this._synced = false;
        }
      };
    }
  });
  return result;
}

var genClass = (firebase, modelName, ref, subSchema) => {
  let props = _getProps(firebase, subSchema);
  return eval(
    `
    /**
      * @class
      * WrapperObject class (extended by each subSchema)
      */
    class ${modelName} extends FirebaseObject {

      /**
       * Create a WrapperObject
       * @constructor
       * @extends FirebaseObject
       * @param {object} snapshot - The snapshot of data from vanilla firebase db admin sdk.
       */
      constructor(snapshot) {
        super(ref, snapshot);
        Object.defineProperties(this, props);
      }

      static _castByKey(key) {
        let snapshot = {
          key: key,
          val: () => null
        };
        var o = new ${modelName}(snapshot);
        o._synced = false;
        return o;
      }

      static _castByObj(obj) {
        let snapshot = {
          key: obj.getKey(),
          val: () => obj.getValue()
        };
        var o = new ${modelName}(snapshot);
        o._synced = obj._synced === true ? true : false;
        return o;
      }

      /**
       * Cast input to custom WrapperObject
       * @param x - Input you wish to cast
       * @returns {WrapperObject}
       */
      static cast(x) {
        if (typeof(x) != "object") return ${modelName}._castByKey(x);
        return ${modelName}._castByObj(x);
      }

      /**
       * Cast inputs to custom WrapperObjects
       * @param objs - Inputs you wish to cast
       * @returns {Array<WrapperObject>}
       */
      static castMany(objs) {
        return objs.map(o => ${modelName}.cast(o));
      }

      /**
       * toString method for debugging purposes
       * @returns {string}
       */
      toString() {
        return util.toString(modelName, this);
      }

      get[Symbol.toStringTag]() {
        return modelName;
      }

      /**
       * Initializes listener for all database event types (except 'value')
       * @variation 1
       * @param {string} field - specific field you want to listen for
       * @param {function} emitCb - callback that triggers when changes detected
       */
      listenForChanges(field, emitCb) {
        let clas = this.constructor;
        super.listenForChanges(field, obj => emitCb(clas.cast(obj)));
      }

      /**
       * Initializes listener for all database event types (except 'value')
       * @variation 2
       * @param {function} emitCb - callback that triggers when changes detected
       */
      listenForChanges(emitCb) {
        this.listenForChanges(null, emitCb);
      }

      /**
       * Check if object exists or not
       * @async
       * @param {string} key - key of the object
       * @returns {Promise<boolean>}
       */
      static async exists(key) {
        return await FirebaseObject.exists(ref, key);
      }

      /**
       * Check if all objects exist or not
       * @async
       * @param {Array<string>} keys - key of the object
       * @returns {Promise<boolean>}
       */
      static async allExists(keys) {
        return await FirebaseObject.allExists(ref, keys);
      }

      /**
       * Get object by key
       * @async
       * @param {string} key - key of the object
       * @returns {Promise<WrapperObject>} - throws error if key does not exist
       */
      static async getByKey(key) {
        let obj = await super.getByKey(ref, key);
        return ${modelName}.cast(obj);
      }

      /**
       * Get all objects
       * @async
       * @returns {Promise<Array<WrapperObject>>}
       */
      static async getAll() {
        let objs = await super.getAll(ref);
        return ${modelName}.castMany(objs);
      }

      /**
       * Get all objects by keys
       * @async
       * @param {Array<string>} keys - keys of objects
       * @returns {Promise<Array<WrapperObject>>}
       */
      static async getAllByKeys(keys) {
        let objs = await super.getAllByKeys(ref, keys);
        return ${modelName}.castMany(objs);
      }

      /**
       * Get all objects by values
       * @async
       * @param {object} fieldToVal - field of the object mapped to value of that field
       * @returns {Promise<Array<WrapperObject>>}
       */
      static async getAllByFields(fieldToVal) {
        let objs = await super.getAllByFields(ref, fieldToVal);
        return ${modelName}.castMany(objs);
      }

      /**
       * Get all objects by bounds
       * @async
       * @param {object} fieldToBound - field of the object mapped to bound of that field (bound is an array with 2 items: start and end (both exclusivley))
       * @returns {Promise<Array<WrapperObject>>}
       */
      static async getAllByBounds(fieldToBound) {
        let objs = await super.getAllByBounds(ref, fieldToBound);
        return ${modelName}.castMany(objs);
      }

      /**
       * Get all objects by field that starts with given value
       * @async
       * @param {string} field - field of the object
       * @param {string} value - the thing the field starts with
       * @returns {Promise<Array<WrapperObject>>}
       */
      static async getAllThatStartsWith(field, value) {
        let objs = await super.getAllThatStartsWith(ref, value);
        return ${modelName}.castMany(objs);
      }

      /**
       * Delete object by key
       * @async
       * @param {string} key - key of the object
       * @returns {Promise<WrapperObject>} - throws error if key does not exist
       */
      static async deleteByKey(key) {
        let obj = await super.deleteByKey(ref, key);
        return ${modelName}.cast(obj);
      }

      /**
       * Update object by key, and values
       * @async
       * @param {string} key - key of the object
       * @param {object} fieldToVal - object with fields of the value you want to update
       * @returns {Promise<WrapperObject>} - throws error if key does not exist
       */
      static async updateByKey(key, fieldToVal) {
        let obj = await super.updateByKey(ref, key, fieldToVal);
        return ${modelName}.cast(obj);
      }

      /**
       * Create object with given value (assigns automatic key)
       * @async
       * @param {object} fieldToVal - field of the object mapped to value of that field
       * @returns {Promise<WrapperObject>}
       */
      static async createByAutoKey(fieldToVal) {
        let obj = await super.createByAutoKey(ref, fieldToVal);
        return ${modelName}.cast(obj);
      }

      /**
       * Create object with given value (assigns manual key)
       * @async
       * @param {string} key - key of object
       * @param {object} fieldToVal - field of the object mapped to value of that field
       * @returns {Promise<WrapperObject>} - throws error if key is taken
       */
      static async createByManualKey(key, fieldToVal) {
        let obj = await super.createByManualKey(ref, key, fieldToVal);
        return ${modelName}.cast(obj);
      }

      /**
       * Run transaction on field of object with atomic function
       * @async
       * @param {string} key - key of object
       * @param {string} field - field you wish to commit the transaction on
       * @param {function} atomicFn - function that represents the transaction being done
       * @returns {Promise<WrapperObject>}
       */
      static async transaction(key, field, atomicFn) {
        let obj = await super.transaction(ref, key, atomicFn);
        return ${modelName}.cast(obj);
      }

      /**
       * Run transaction (increase/decrease of number) on field of object
       * @async
       * @param {string} key - key of object
       * @param {string} field - field you wish to commit the transaction on
       * @param {number} delta - amount to change the number by
       * @returns {Promise<WrapperObject>}
       */
      static async transactNum(key, field, delta) {
        let obj = await super.transactNum(ref, key, field, delta);
        return ${modelName}.cast(obj);
      }

      /**
       * Run transaction (append item to list) on field of object
       * @async
       * @param {string} key - key of object
       * @param {string} field - field you wish to commit the transaction on
       * @param value - value you want to append to the array
       * @param {boolean} [isUniqueList] - True means its a Set, False means its a List
       * @returns {Promise<WrapperObject>}
       */
      static async transactAppendToList(key, field, value, isUniqueList) {
        let obj = await super
          .transactAppendToList(ref, key, field, value, isUniqueList);
        return ${modelName}.cast(obj);
      }

      /**
       * Run transaction (remove item from list) on field of object
       * @async
       * @param {string} key - key of object
       * @param {string} field - field you wish to commit the transaction on
       * @param value - value you want to remove from the array
       * @param {boolean} [isUniqueList] - True means its a Set, False means its a List
       * @returns {Promise<WrapperObject>}
       */
      static async transactRemoveFromList(key, field, value, isUniqueList) {
        let obj = await super
          .transactRemoveFromList(ref, key, field, value, isUniqueList);
        return ${modelName}.cast(obj);
      }

      /**
       * Initializes listener for all database event types (except 'value') with query
       * @param {string} [field] - specific field you want to listen for (needed if value passed in)
       * @param [value] - value the field should be equal to (needed if field passed in)
       * @param {function} emitCb - callback that triggers when changes detected
       */
      static listenForQuery(field, value, emitCb) {
        super.listenForQuery(ref, field, value, obj => emitCb(${modelName}.cast(
          obj)));
      }
    } ${modelName}`
  );
}

module.exports = genClass;
