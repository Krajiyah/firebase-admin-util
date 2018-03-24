// DEPENDENCIES
const util = require("./util.js");

// CONSTANTS
const objNotExistErr = "Object with key does not exist";
const objExistErr = "Object with key already exists";
const transAbortErr = "transaction not committed!";

// HELPERS
let _getUnixTS = () => new Date().getTime();

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
		}, true);
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

// CLASS
class FirebaseObject {
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
	json() {
		return {
			key: this._key,
			value: this._value
		}
	}
	static jsonAll(objs) {
		return objs.map(obj => obj.json());
	}
	static _copyValues(src, dest) {
		dest._value = src._value;
		dest._synced = true;
	}
	toString() {
		return util.toString("FirebaseObject", this);
	}
	get[Symbol.toStringTag]() {
		return "FirebaseObject";
	}
	getEvent() {
		return this._event;
	}
	getValue() {
		return this._value;
	}
	getTimeUpdated() {
		if (!this._value) return null;
		return this._value._updated;
	}
	getKey() {
		return this._key;
	}
	isSynced() {
		return this._synced;
	}
	async push() {
		await this.update(this._value)
		this._synced = true;
	}
	async fetch() {
		let obj = await FirebaseObject.getByKey(this._ref, this._key);
		FirebaseObject._copyValues(obj, this);
	}
	async delete() {
		let obj = await FirebaseObject.deleteByKey(this._ref, this._key);
		this._value = null;
		this._synced = true;
	}
	async update(fieldToVal) {
		let obj = await FirebaseObject.updateByKey(this._ref, this._key, fieldToVal);
		FirebaseObject._copyValues(obj, this);
	}
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
	listenForChanges(emitCb) {
		this.listenForChanges(null, emitCb);
	}
	async transaction(field, atomicFn) {
		let obj = await FirebaseObject
			.transaction(this._ref, this._key, field, atomicFn)
		FirebaseObject._copyValues(obj, this);
	}
	async transactNum(field, delta) {
		let obj = await FirebaseObject
			.transactNum(this._ref, this._key, field, delta)
		FirebaseObject._copyValues(obj, this);
	}
	async transactAppendToList(field, value, isUniqueList) {
		let obj = await FirebaseObject
			.transactAppendToList(this._ref, this._key, field, value, isUniqueList)
		FirebaseObject._copyValues(obj, this);
	}
	async transactRemoveFromList(field, value, isUniqueList) {
		let obj = await FirebaseObject
			.transactRemoveFromList(this._ref, this._key, field, value, isUniqueList)
		FirebaseObject._copyValues(obj, this);
	}
	static async getByKey(ref, key) {
		let snapshot = await _getSnapshot(ref, key);
		if (!snapshot.exists())
			throw new Error(objNotExistErr);
		return new FirebaseObject(ref, snapshot);
	}
	static async getAll(ref) {
		let snapshot = await _getSnapshot(ref);
		return _multipleConstructCb(ref)(snapshot);
	}
	static async getAllByKeys(ref, keys) {
		let objs = await FirebaseObject.getAll(ref);
		return objs.filter(obj => keys.indexOf(obj._key) >= 0);
	}
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
	static async getAllByBounds(ref, fieldToBound) {
		let primaryField = Object.keys(fieldToBound)[0];
		let primaryBound = fieldToBound[primaryField];
		let snapshot = await _getSnapshotByBound(ref, primaryField, primaryBound);
		let objs = _multipleConstructCb(ref)(snapshot);
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
	static async getAllThatStartsWith(ref, field, value) {
		let bound = [value, value + "\uf8ff"];
		let snapshot = await _getSnapshotByBound(ref, field, bound);
		return _multipleConstructCb(ref)(snapshot);
	}
	static getKeysExist(ref, keys) {
		return keys.reduce(async(bool, key) => {
			let snapshot = await _getSnapshot(ref, key);
			return bool && snapshot.exists();
		}, true)
	}
	static async deleteByKey(ref, key) {
		let obj = await FirebaseObject.getByKey(ref, key);
		await _remove(ref, key);
		return obj;
	}
	static async updateByKey(ref, key, fieldToVal) {
		let exists = await FirebaseObject.getKeysExist(ref, [key]);
		if (!exists) throw new Error(objNotExistErr);
		fieldToVal._updated = _getUnixTS();
		await _update(ref, key, fieldToVal);
		return await FirebaseObject.getByKey(ref, key);
	}
	static async createByAutoKey(ref, fieldToVal) {
		fieldToVal._updated = _getUnixTS();
		let newRef = ref.push();
		await _set(newRef, fieldToVal);
		return await FirebaseObject.getByKey(ref, newRef.key);
	}
	static async createByManualKey(ref, key, fieldToVal) {
		let exists = await FirebaseObject.getKeysExist(ref, [key]);
		if (exists) throw new Error(objExistErr);
		fieldToVal._updated = _getUnixTS();
		await _set(ref.child(key), fieldToVal);
		return await FirebaseObject.getByKey(ref, key);
	}
	static async transaction(ref, key, field, atomicFn) {
		return await _transaction(ref, key, field, atomicFn);
	}
	static async transactNum(ref, key, field, delta) {
		return await FirebaseObject.transaction(ref, key, field, (value) => {
			value = value || 0;
			value += delta;
			return value;
		});
	}
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
