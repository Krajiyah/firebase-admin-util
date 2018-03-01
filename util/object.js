// DEPENDENCIES
const util = require("./util.js");

// CONSTANTS
const objNotExistErr = "Object with key does not exist";
const objExistErr = "Object with key already exists";
const transAbortErr = "transaction not committed!";

// HELPERS
let _getUnixTS = () => new Date().getTime();

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
		src._value = dest._value;
		src._synced = true;
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
	push() {
		this.update(this._value)
		this._synced = true;
	}
	fetch() {
		let obj = FirebaseObject.getByKey(this._ref, this._key);
		FirebaseObject._copyValues(obj, this);
	}
	delete() {
		let obj = FirebaseObject.deleteByKey(this._ref, this._key);
		this._value = null;
		this._synced = true;
	}
	update(fieldToVal) {
		let obj = FirebaseObject.updateByKey(this._ref, this._key, fieldToVal);
		FirebaseObject._copyValues(obj, this);
	}
	listenForChanges(field, emitCb) {
		let that = this;
		_listenOnRef(this._ref.child(this._key), type => {
			return snapshot => {
				if (!field || snapshot.key == field) {
					let obj = FirebaseObject.getByKey(that._ref, that._key);
					obj._event = type;
					emitCb(obj);
				}
			}
		}, field != null);
	}
	listenForChanges(emitCb) {
		this.listenForChanges(null, emitCb);
	}
	transaction(field, atomicFn) {
		let obj = FirebaseObject.transaction(this._ref, this._key, field, atomicFn)
		FirebaseObject._copyValues(obj, this);
	}
	transactNum(field, delta) {
		let obj = FirebaseObject.transactNum(this._ref, this._key, field, delta)
		FirebaseObject._copyValues(obj, this);
	}
	transactAppendToList(field, value, isUniqueList) {
		let obj = FirebaseObject
			.transactAppendToList(this._ref, this._key, field, value, isUniqueList)
		FirebaseObject._copyValues(obj, this);
	}
	transactRemoveFromList(field, value, isUniqueList) {
		let obj = FirebaseObject
			.transactRemoveFromList(this._ref, this._key, field, value, isUniqueList)
		FirebaseObject._copyValues(obj, this);
	}
	static getByKey(ref, key) {
		let snapshot = await ref.child(key).once("value");
		if (!snapshot.exists())
			throw new Error(objNotExistErr);
		return new FirebaseObject(ref, snapshot);
	}
	static getAll(ref) {
		return await ref.once("value").then(_multipleConstructCb(ref));
	}
	static getAllByKeys(ref, keys) {
		let objs = FirebaseObject.getAll(ref);
		return objs.filter(obj => keys.indexOf(obj._key) >= 0);
	}
	static getAllByFields(ref, fieldToVal) {
		let primaryField = Object.keys(fieldToVal)[0];
		let primaryVal = fieldToVal[primaryField];
		return await ref.orderByChild(primaryField).equalTo(primaryVal)
			.once("value").then(_multipleConstructCb(ref)).then(objects => {
				return objects.filter(object => {
					return Object.keys(fieldToVal).reduce((bool, key) => {
						let val = fieldToVal[key];
						let objVal = object._value[key];
						return bool && objVal == val;
					}, true);
				});
			});
	}
	static getAllByBounds(ref, fieldToBound) {
		let primaryField = Object.keys(fieldToBound)[0];
		let primaryBound = fieldToBound[primaryField];
		return await ref.orderByChild(primaryField).startAt(primaryBound[0])
			.endAt(primaryBound[1]).once("value").then(_multipleConstructCb(ref))
			.then(objects => {
				return objects.filter(object => {
					return Object.keys(fieldToBound).reduce((bool, key) => {
						let bound = fieldToBound[key];
						let objectVal = object._value[key];
						if (objectVal < bound[0] || objectVal > bound[1])
							return false;
						return true;
					}, true);
				});
			});
	}
	static getAllThatStartsWith(ref, field, value) {
		return await ref.orderByChild(field).startAt(value)
			.endAt(value + "\uf8ff").once("value").then(_multipleConstructCb(ref));
	}
	static getKeysExist(ref, keys) {
		return keys.reduce((bool, key) => {
			let snapshot = await ref.child(key).once("value");
			return bool && snapshot.exists();
		}, true)
	}
	static deleteByKey(ref, key) {
		let obj = FirebaseObject.getByKey(ref, key);
		await ref.child(key).remove();
		return obj;
	}
	static updateByKey(ref, key, fieldToVal) {
		let exists = FirebaseObject.getKeysExist(ref, [key]);
		if (!exists) throw new Error(objNotExistErr);
		fieldToVal._updated = _getUnixTS();
		await ref.child(key).update(fieldToVal);
		return FirebaseObject.getByKey(ref, key);
	}
	static createByAutoKey(ref, fieldToVal) {
		fieldToVal._updated = _getUnixTS();
		let newRef = ref.push();
		await newRef.set(fieldToVal)
		return FirebaseObject.getByKey(ref, newRef.key);
	}
	static createByManualKey(ref, key, fieldToVal) {
		let exists = FirebaseObject.getKeysExist(ref, [key]);
		if (exists) throw new Error(objExistErr);
		fieldToVal._updated = _getUnixTS();
		await ref.child(key).set(fieldToVal);
		return FirebaseObject.getByKey(ref, key);
	}
	static transaction(ref, key, field, atomicFn) {
		return await new Promise((resolve, reject) => {
			ref.child(key).child(field).transaction(atomicFn, (err, commit, snapshot) => {
				if (err) reject(err);
				else if (!commit) reject(new Error(transAbortErr));
				else resolve(FirebaseObject.getByKey(ref, key));
			}, true);
		});
	}
	static transactNum(ref, key, field, delta) {
		return FirebaseObject.transaction(ref, key, field, (value) => {
			value = value || 0;
			value += delta;
			return value;
		});
	}
	static transactAppendToList(ref, key, field, value, isUniqueList) {
		return FirebaseObject.transaction(ref, key, field, (arr) => {
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
	static transactRemoveFromList(ref, key, field, value, isUniqueList) {
		return FirebaseObject.transaction(ref, key, field, (arr) => {
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
