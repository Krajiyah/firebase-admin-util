const util = require("./util.js");

const objNotExistErr = "Object with key does not exist";
const objExistErr = "Object with key already exists";
const transAbortErr = "transaction not committed!";

let _getUnixTS = () => Math.floor(new Date().getTime() / 1000);

let _getSnapshot = async(ref, key) => {
	if (key) ref = ref.child(key);
	return await ref.once("value");
}

let _getSnapshotByQuery = async(ref, field, value) => {
	// TODO: bug with equalTo found
	// return await ref.orderByChild(field).equalTo(value).once("value");
	return await ref.once("value");
}

let _getSnapshotByBound = async(ref, field, bound) => {
	// TODO: possible bug with startAt and endAt
	// return await ref.orderByChild(field).startAt(bound[0])
	// 	.endAt(bound[1]).once("value");
	return await ref.once("value");
}

let _remove = async(ref, key) => await ref.child(key).remove()

let _update = async(ref, key, fieldToVal) => {
	return await ref.child(key).update(fieldToVal);
}

let _set = async(ref, value) => await ref.set(value);

let _transaction = async(ref, key, field, atomicFn) => {
	return await new Promise((resolve, reject) => {
		ref.child(key).child(field).transaction(atomicFn, (err, commit, snapshot) => {
			if (err) reject(err);
			else if (!commit) reject(new Error(transAbortErr));
			else resolve(FirebaseObject.getByKey(ref, key));
		}, false);
	});
}

let _multipleConstructCb = (ref) => {
	return snapshot => {
		if (!snapshot.exists()) return [];
		var result = [];
		snapshot.forEach(childSnapshot => {
			result.push(new FirebaseObject(ref, childSnapshot));
		});
		return result;
	}
}

let _listenOnRef = (ref, cb, isChild) => {
	ref.on("child_removed", cb(isChild === true ? "child_removed" : "removed"));
	ref.on("child_added", cb(isChild === true ? "child_added" : "added"));
	ref.on("child_changed", cb(isChild === true ? "child_changed" : "changed"));
}

/**
 * Generic FirebaseObject class (extended by all mapped classes)
 */
class FirebaseObject {

	/**
	 * Create a FirebaseObject
	 * @constructor
	 * @param {object} ref - The database reference.
	 * @param {object} snapshot - The snapshot of data from vanilla firebase db admin sdk.
	 */
	constructor(ref, snapshot) {
		this._ref = ref;
		this._event = "value";
		this._synced = true;
		if (!snapshot) {
			this._value = null;
			this._key = null;
		} else {
			this._value = snapshot.val();
			this._key = snapshot.key;
		}
	}

	/**
	 * JSON representation of FirebaseObject
	 * @typedef {Object} JSON
	 * @property {string} key - The key of the object
	 * @property {object} value - The value of the object
	 */

	/**
	 * Package object into easy digestable json
	 * @returns {JSON}
	 */
	json() {
		return {
			key: this._key,
			value: this._value
		}
	}

	/**
	 * Package objects into easy digestable jsons
	 * @returns {Array<JSON>}
	 */
	static jsonAll(objs) {
		return objs.map(obj => obj.json());
	}

	static _copyValues(src, dest) {
		dest._value = src._value;
		dest._synced = true;
	}

	/**
	 * toString method for debugging purposes
	 * @returns {string}
	 */
	toString() {
		return util.toString("FirebaseObject", this);
	}

	get[Symbol.toStringTag]() {
		return "FirebaseObject";
	}

	/**
	 * Possible event strings: 'value', 'added', 'changed', 'removed'.
	 * 'value' indicates its a one time value fetched objects.
	 * 'added' indicates the object was fetched in child_added listener.
	 * 'changed' indicates the object was fetched in child_changed listener.
	 * 'removed' indiciates the object was fetched in child_removed listener.
	 * @returns {string}
	 */
	getEvent() {
		return this._event;
	}

	/**
	 * Returns value of the object.
	 * @returns {object}
	 */
	getValue() {
		return this._value;
	}

	/**
	 * Returns epoch unix timestamp of when object was last changed, or null if no update field set.
	 * @returns {null|number}
	 */
	getTimeUpdated() {
		if (!this._value) return null;
		return this._value._updated;
	}

	/**
	 * Returns key of the object.
	 * @returns {string}
	 */
	getKey() {
		return this._key;
	}

	/**
	 * Returns whether or not object is synced with database.
	 * @returns {boolean}
	 */
	isSynced() {
		return this._synced;
	}

	/**
	 * Pushes changes to this object to database
	 * @async
	 */
	async push() {
		await this.update(this._value)
		this._synced = true;
	}

	/**
	 * Fetches changes to this object from database
	 * @async
	 */
	async fetch() {
		let obj = await FirebaseObject.getByKey(this._ref, this._key);
		FirebaseObject._copyValues(obj, this);
	}

	/**
	 * Deletes object locally and remotely
	 * @async
	 */
	async delete() {
		let obj = await FirebaseObject.deleteByKey(this._ref, this._key);
		this._value = null;
		this._synced = true;
	}

	/**
	 * Updates object locally and remotely
	 * @async
	 * @param {object} fieldToVal - object with fields of the value you want to update
	 */
	async update(fieldToVal) {
		let obj = await FirebaseObject.updateByKey(this._ref, this._key, fieldToVal);
		FirebaseObject._copyValues(obj, this);
	}

	/**
	 * Initializes listener for all database event types (except 'value')
	 * @variation 1
	 * @param {string} field - specific field you want to listen for
	 * @param {function} emitCb - callback that triggers when changes detected
	 */
	listenForChanges(field, emitCb) {
		let that = this;
		_listenOnRef(this._ref.child(this._key), type => {
			return async snapshot => {
				if (!field || snapshot.key == field) {
					let obj = await FirebaseObject.getByKey(that._ref, that._key);
					obj._event = type;
					emitCb(obj);
				}
			}
		}, field != null);
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
	 * Run transaction on field of object with atomic function (applies changes locally and remotely)
	 * @async
	 * @param {string} field - field you wish to commit the transaction on
	 * @param {function} atomicFn - function that represents the transaction being done
	 */
	async transaction(field, atomicFn) {
		let obj = await FirebaseObject
			.transaction(this._ref, this._key, field, atomicFn)
		FirebaseObject._copyValues(obj, this);
	}

	/**
	 * Run transaction (increase/decrease of number) on field of object (applies changes locally and remotely)
	 * @async
	 * @param {string} field - field you wish to commit the transaction on
	 * @param {number} delta - amount to change the number by
	 */
	async transactNum(field, delta) {
		let obj = await FirebaseObject
			.transactNum(this._ref, this._key, field, delta)
		FirebaseObject._copyValues(obj, this);
	}

	/**
	 * Run transaction (append item to list) on field of object (applies changes locally and remotely)
	 * @async
	 * @param {string} field - field you wish to commit the transaction on
	 * @param value - value you want to append to the array
	 * @param {boolean} [isUniqueList] - True means its a Set, False means its a List
	 */
	async transactAppendToList(field, value, isUniqueList) {
		let obj = await FirebaseObject
			.transactAppendToList(this._ref, this._key, field, value, isUniqueList)
		FirebaseObject._copyValues(obj, this);
	}

	/**
	 * Run transaction (remove item from list) on field of object (applies changes locally and remotely)
	 * @async
	 * @param {string} field - field you wish to commit the transaction on
	 * @param value - value you want to remove from the array
	 * @param {boolean} [isUniqueList] - True means its a Set, False means its a List
	 */
	async transactRemoveFromList(field, value, isUniqueList) {
		let obj = await FirebaseObject
			.transactRemoveFromList(this._ref, this._key, field, value, isUniqueList)
		FirebaseObject._copyValues(obj, this);
	}

	/**
	 * Check if object exists or not
	 * @async
	 * @param {object} ref - database reference
	 * @param {string} key - key of the object
	 * @returns {Promise<boolean>}
	 */
	static async exists(ref, key) {
		let snapshot = await _getSnapshot(ref, key);
		return snapshot.exists();
	}

	/**
	 * Check if all objects exist or not
	 * @async
	 * @param {object} ref - database reference
	 * @param {Array<string>} keys - key of the object
	 * @returns {Promise<boolean>}
	 */
	static async allExists(ref, keys) {
		for (let i = 0; i < keys.length; i++) {
			let key = keys[i];
			let b = await FirebaseObject.exists(ref, key);
			if (!b) return false;
		}
		return true;
	}

	/**
	 * Get object by database reference and key
	 * @async
	 * @param {object} ref - database reference
	 * @param {string} key - key of the object
	 * @returns {Promise<FirebaseObject>} - throws error if key does not exist
	 */
	static async getByKey(ref, key) {
		let snapshot = await _getSnapshot(ref, key);
		if (!snapshot.exists())
			throw new Error(objNotExistErr);
		return new FirebaseObject(ref, snapshot);
	}

	/**
	 * Get all objects by database reference
	 * @async
	 * @param {object} ref - database reference
	 * @returns {Promise<Array<FirebaseObject>>}
	 */
	static async getAll(ref) {
		let snapshot = await _getSnapshot(ref);
		return _multipleConstructCb(ref)(snapshot);
	}

	/**
	 * Get all objects by database reference and keys
	 * @async
	 * @param {object} ref - database reference
	 * @param {Array<string>} keys - keys of objects
	 * @returns {Promise<Array<FirebaseObject>>}
	 */
	static async getAllByKeys(ref, keys) {
		let objs = await FirebaseObject.getAll(ref);
		return objs.filter(obj => keys.indexOf(obj._key) >= 0);
	}

	/**
	 * Get all objects by database reference and values
	 * @async
	 * @param {object} ref - database reference
	 * @param {object} fieldToVal - field of the object mapped to value of that field
	 * @returns {Promise<Array<FirebaseObject>>}
	 */
	static async getAllByFields(ref, fieldToVal) {
		let primaryField = Object.keys(fieldToVal)[0];
		let primaryVal = fieldToVal[primaryField];
		let snapshot = await _getSnapshotByQuery(ref, primaryField, primaryVal);
		let objects = _multipleConstructCb(ref)(snapshot);
		return objects.filter(object => {
			return Object.keys(fieldToVal).reduce((bool, key) => {
				let val = fieldToVal[key];
				let objVal = object._value[key];
				return bool && objVal == val;
			}, true);
		});
	}

	/**
	 * Get all objects by database reference and bounds
	 * @async
	 * @param {object} ref - database reference
	 * @param {object} fieldToBound - field of the object mapped to bound of that field (bound is an array with 2 items: start and end (both exclusivley))
	 * @returns {Promise<Array<FirebaseObject>>}
	 */
	static async getAllByBounds(ref, fieldToBound) {
		let primaryField = Object.keys(fieldToBound)[0];
		let primaryBound = fieldToBound[primaryField];
		let snapshot = await _getSnapshotByBound(ref, primaryField, primaryBound);
		let objects = _multipleConstructCb(ref)(snapshot);
		return objects.filter(object => {
			return Object.keys(fieldToBound).reduce((bool, key) => {
				let bound = fieldToBound[key];
				let objectVal = object._value[key];
				if (objectVal < bound[0] || objectVal > bound[1])
					return false;
				return true;
			}, true);
		});
	}

	/**
	 * Get all objects by database reference and field that starts with given value
	 * @async
	 * @param {object} ref - database reference
	 * @param {string} field - field of the object
	 * @param {string} value - the thing the field starts with
	 * @returns {Promise<Array<FirebaseObject>>}
	 */
	static async getAllThatStartsWith(ref, field, value) {
		let bound = [value, value + "\uf8ff"];
		let snapshot = await _getSnapshotByBound(ref, field, bound);
		return _multipleConstructCb(ref)(snapshot);
	}

	/**
	 * Delete object by reference and key
	 * @async
	 * @param {object} ref - database reference
	 * @param {string} key - key of the object
	 * @returns {Promise<FirebaseObject>} - throws error if key does not exist
	 */
	static async deleteByKey(ref, key) {
		let obj = await FirebaseObject.getByKey(ref, key);
		await _remove(ref, key);
		return obj;
	}

	/**
	 * Update object by reference, key, and values
	 * @async
	 * @param {object} ref - database reference
	 * @param {string} key - key of the object
	 * @param {object} fieldToVal - object with fields of the value you want to update
	 * @returns {Promise<FirebaseObject>} - throws error if key does not exist
	 */
	static async updateByKey(ref, key, fieldToVal) {
		let exists = await FirebaseObject.exists(ref, key);
		if (!exists) throw new Error(objNotExistErr);
		fieldToVal._updated = _getUnixTS();
		await _update(ref, key, fieldToVal);
		return await FirebaseObject.getByKey(ref, key);
	}

	/**
	 * Create object by reference and with given value (assigns automatic key)
	 * @async
	 * @param {object} ref - database reference
	 * @param {object} fieldToVal - field of the object mapped to value of that field
	 * @returns {Promise<FirebaseObject>}
	 */
	static async createByAutoKey(ref, fieldToVal) {
		fieldToVal._updated = _getUnixTS();
		let newRef = ref.push();
		await _set(newRef, fieldToVal);
		return await FirebaseObject.getByKey(ref, newRef.key);
	}

	/**
	 * Create object by reference and with given value (assigns manual key)
	 * @async
	 * @param {object} ref - database reference
	 * @param {string} key - key of object
	 * @param {object} fieldToVal - field of the object mapped to value of that field
	 * @returns {Promise<FirebaseObject>} - throws error if key is taken
	 */
	static async createByManualKey(ref, key, fieldToVal) {
		let exists = await FirebaseObject.exists(ref, key);
		if (exists) throw new Error(objExistErr);
		fieldToVal._updated = _getUnixTS();
		await _set(ref.child(key), fieldToVal);
		return await FirebaseObject.getByKey(ref, key);
	}

	/**
	 * Run transaction on field of object with atomic function
	 * @async
	 * @param {object} ref - database reference
	 * @param {string} key - key of object
	 * @param {string} field - field you wish to commit the transaction on
	 * @param {function} atomicFn - function that represents the transaction being done
	 * @returns {Promise<FirebaseObject>}
	 */
	static async transaction(ref, key, field, atomicFn) {
		return await _transaction(ref, key, field, atomicFn);
	}

	/**
	 * Run transaction (increase/decrease of number) on field of object
	 * @async
	 * @param {object} ref - database reference
	 * @param {string} key - key of object
	 * @param {string} field - field you wish to commit the transaction on
	 * @param {number} delta - amount to change the number by
	 * @returns {Promise<FirebaseObject>}
	 */
	static async transactNum(ref, key, field, delta) {
		return await FirebaseObject.transaction(ref, key, field, (value) => {
			value = value || 0;
			value += delta;
			return value;
		});
	}

	/**
	 * Run transaction (append item to list) on field of object
	 * @async
	 * @param {object} ref - database reference
	 * @param {string} key - key of object
	 * @param {string} field - field you wish to commit the transaction on
	 * @param value - value you want to append to the array
	 * @param {boolean} [isUniqueList] - True means its a Set, False means its a List
	 * @returns {Promise<FirebaseObject>}
	 */
	static async transactAppendToList(ref, key, field, value, isUniqueList) {
		return await FirebaseObject.transaction(ref, key, field, (arr) => {
			if (isUniqueList) {
				arr = arr || new Set();
				arr.add(value);
				arr = Array.from(arr);
			} else {
				arr = arr || [];
				arr.push(value);
			}
			return arr;
		});
	}

	/**
	 * Run transaction (remove item from list) on field of object
	 * @async
	 * @param {object} ref - database reference
	 * @param {string} key - key of object
	 * @param {string} field - field you wish to commit the transaction on
	 * @param value - value you want to remove from the array
	 * @param {boolean} [isUniqueList] - True means its a Set, False means its a List
	 * @returns {Promise<FirebaseObject>}
	 */
	static async transactRemoveFromList(ref, key, field, value, isUniqueList) {
		return await FirebaseObject.transaction(ref, key, field, (arr) => {
			if (isUniqueList) {
				arr = arr || new Set();
				arr.delete(value);
				arr = Array.from(arr);
			} else {
				arr = arr || [];
				var index = arr.indexOf(value);
				arr.splice(index, 1);
			}
			return arr;
		});
	}

	/**
	 * Initializes listener for all database event types (except 'value') with query
	 * @param {object} ref - database reference
	 * @param {string} [field] - specific field you want to listen for (needed if value passed in)
	 * @param [value] - value the field should be equal to (needed if field passed in)
	 * @param {function} emitCb - callback that triggers when changes detected
	 */
	static listenForQuery(ref, field, value, emitCb) {
		_listenOnRef(ref, type => {
			return snapshot => {
				var obj = new FirebaseObject(ref, snapshot);
				obj._event = type;
				if (!field || !value || obj._value[field] == value) {
					obj._key = snapshot.key;
					obj._event = type;
					emitCb(obj);
				}
			}
		});
	}
}

// EXPORTS
module.exports = FirebaseObject;
