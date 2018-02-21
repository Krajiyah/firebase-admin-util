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

var _exportedModule = (firebase, schema) => {
	const rootRef = firebase.database().ref();
	const refs = {};
	Object.keys(schema).forEach(ref => {
		refs[ref] = rootRef.child(schema[ref]);
	});
	FirebaseObject.refs = refs;
	return FirebaseObject;
}

// CLASS
class FirebaseObject {
	constructor(ref, snapshot) {
		this._ref = ref;
		this._event = "value";
		if (!snapshot) {
			this._value = null;
			this._key = null;
		} else {
			this._value = snapshot.val();
			this._key = snapshot.key;
		}
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
	delete() {
		return FirebaseObject.deleteByKey(this._ref, this._key);
	}
	update(fieldToVal) {
		return FirebaseObject.updateByKey(this._ref, this._key, fieldToVal);
	}
	listenForChanges(field, emitCb) {
		_listenOnRef(this._ref.child(this._key), type => {
			return snapshot => {
				if (!field || snapshot.key == field) {
					FirebaseObject.getByKey(this._ref, this._key).then(obj => {
						obj._event = type;
						emitCb(obj);
					});
				}
			}
		}, field != null);
	}
	listenForChanges(emitCb) {
		this.listenForChanges(null, emitCb);
	}
	static getByKey(ref, key) {
		return ref.child(key).once("value").then(snapshot => {
			if (!snapshot.exists())
				return Promise.reject("Object with key " + key +
					" does not exist in the database");
			return new FirebaseObject(ref, snapshot);
		});
	}
	static getAll(ref) {
		return ref.once("value").then(_multipleConstructCb);
	}
	static getAllByKeys(ref, keys) {
		return FirebaseObject.getAll(ref).then(objs => {
			return objs.filter(obj => keys.indexOf(obj._key) >= 0);
		});
	}
	static getAllByFields(ref, fieldToVal) {
		let primaryField = Object.keys(fieldToVal)[0];
		let primaryVal = fieldToVal[primaryField];
		return ref.orderByChild(primaryField).equalTo(primaryVal)
			.once("value").then(_multipleConstructCb).then(objects => {
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
		return ref.orderByChild(primaryField).startAt(primaryBound[0])
			.endAt(primaryBound[1]).once("value").then(_multipleConstructCb)
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
		return ref.orderByChild(field).startAt(value)
			.endAt(value + "\uf8ff").once("value").then(_multipleConstructCb);
	}
	static getKeysExist(ref, keys) {
		var exists = true;
		return Promise.all(keys.map(key => {
			return ref.child(key).once("value").then(snapshot => {
				if (!snapshot.exists()) exists = false;
			});
		})).then(() => {
			return exists;
		});
	}
	static deleteByKey(ref, key) {
		return FirebaseObject.getByKey(ref, key).then(obj => {
			return ref.child(key).remove().then(() => {
				return obj;
			});
		});
	}
	static updateByKey(ref, key, fieldToVal) {
		return FirebaseObject.getByKey(ref, key).then(() => {
			fieldToVal._updated = _getUnixTS();
			return ref.child(key).update(fieldToVal)
		}).then(() => FirebaseObject.getByKey(ref, key));
	}
	static createByAutoKey(ref, fieldToVal) {
		fieldToVal._updated = _getUnixTS();
		let newRef = ref.push();
		return newRef.set(fieldToVal)
			.then(() => FirebaseObject.getByKey(ref, newRef.key));
	}
	static createByManualKey(ref, key, fieldToVal) {
		return FirebaseObject.getByKey(ref, key).then(() => {
			return Promise.reject(new Error("Object with key " + key +
				" already exists in database"));
		}).then(() => {
			fieldToVal._updated = _getUnixTS();
			return ref.child(key).set(fieldToVal);
		}).then(() => FirebaseObject.getByKey(ref, key));
	}
	static transaction(ref, key, field, atomicFn) {
		return new Promise((resolve, reject) => {
			ref.child(key).child(field).transaction(atomicFn, (err, commit, snapshot) => {
				if (err) reject(error);
				else if (!commit) reject(new Error("transaction not committed!"));
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
module.exports = _exportedModule;
