module.exports = function(firebase, schema) {
	const rootRef = firebase.database().ref();
	const refs = {};
	Object.keys(schema).forEach(ref => {
		refs[ref] = rootRef.child(schema[ref]);
	});

	let singleCallback = (parentKey, snapshot) => {
		var obj = snapshot.val();
		obj._key = snapshot.key;
		obj._parentNode = parentKey;
		return obj;
	}

	let multipleCallback = snapshot => {
		if (!snapshot.exists()) return [];
		var result = [];
		snapshot.forEach(childSnapshot => {
			result.push(singleCallback(snapshot.ref.key, childSnapshot));
		});
		return result;
	}

	let getByKey = (ref, key) => {
		return ref.child(key).once("value").then(snapshot => {
			if (!snapshot.exists())
				return Promise.reject("Object with key " + key +
					" does not exist in the database");
			return singleCallback(ref.key, snapshot);
		});
	}

	return {
		refs: refs,
		listenForQuery: (pathStr, param, value, objCb) => {
			let genCb = type => {
				return snapshot => {
					var obj = snapshot.val();
					if (!param || !value || obj[param] == value) {
						obj._key = snapshot.key;
						obj._event = type;
						objCb(obj);
					}
				}
			}
			var ref;
			if (pathStr.indexOf("_") < 0)
				ref = rootRef.child(pathStr);
			else {
				ref = rootRef;
				pathStr.split("_").forEach(nodeStr => {
					ref = ref.child(nodeStr);
				});
			}
			ref.on("child_removed", genCb("removed"));
			ref.on("child_added", genCb("added"));
			ref.on("child_changed", genCb("changed"));
		},
		getAll: ref => ref.once("value").then(multipleCallback),
		getStartsWith: (ref, param, value) => {
			return ref.orderByChild(param).startAt(value)
				.endAt(value + "\uf8ff").once("value").then(multipleCallback);
		},
		getByBounds: (ref, fieldToBound) => {
			let primaryField = Object.keys(fieldToBound)[0];
			let primaryBound = fieldToBound[primaryField];
			return ref.orderByChild(primaryField).startAt(primaryBound[0])
				.endAt(primaryBound[1]).once("value").then(multipleCallback)
				.then(objects => {
					return objects.filter(object => {
						return Object.keys(fieldToBound).reduce((bool, key) => {
							let bound = fieldToBound[key];
							let objectVal = object[key];
							if (objectVal < bound[0] || objectVal > bound[1])
								return false;
							return true;
						}, true);
					});
				});
		},
		getByFields: (ref, fieldToVal) => {
			let primaryField = Object.keys(fieldToVal)[0];
			let primaryVal = fieldToVal[primaryField];
			return ref.orderByChild(primaryField).equalTo(primaryVal).once("value")
				.then(multipleCallback).then(objects => {
					return objects.filter(object => {
						return Object.keys(fieldToVal).reduce((bool, key) => {
							let val = fieldToVal[key];
							let objVal = object[key];
							return bool && objVal == val;
						}, true);
					});
				});
		},
		keysExist: (ref, keys) => {
			var exists = true;
			return Promise.all(keys.map(key => {
				return ref.child(key).once("value").then(snapshot => {
					if (!snapshot.exists()) exists = false;
				});
			})).then(() => {
				return exists;
			});
		},
		deleteByKey: (ref, key) => {
			return getByKey(ref, key).then(obj => {
				return ref.child(key).remove().then(() => {
					return obj;
				});
			});
		},
		getByKey: getByKey,
		getByKeys: (ref, keys) => {
			return getAll(ref).then(objs => {
				return objs.filter(obj => keys.indexOf(obj._key) >= 0);
			});
		},
		doTransaction: (ref, transFunc) => {
			return new Promise((resolve, reject) => {
				ref.transaction(transFunc, (err, commit, snapshot) => {
					if (err) reject(error);
					else if (!commit) reject(new Error("transaction not committed!"));
					else if (!snapshot.exists()) resolve(null);
					else resolve(singleCallback(snapshot.ref.key, snapshot));
				}, true);
			});
		},
		getLessThan: (ref, param, value) => {
			return ref.orderByChild(param).endAt(value).once("value")
				.then(multipleCallback);
		},
		getGreaterThan: (ref, param, value) => {
			return ref.orderByChild(param).startAt(value).once("value")
				.then(multipleCallback);
		},
		updateByKey: (ref, key, fieldToVal) => {
			let unixTS = new Date().getTime();
			fieldToVal.lastUpdated = unixTS;
			return ref.child(key).update(fieldToVal).then(() => getByKey(ref, key));
		},
		createByAutoKey: (ref, fieldToVal) => {
			let unixTS = new Date().getTime();
			fieldToVal.lastUpdated = unixTS;
			let newRef = ref.push();
			return newRef.set(fieldToVal).then(() => getByKey(ref, newRef.key));
		},
		createByManualKey: (ref, key, fieldToVal) => {
			let unixTS = new Date().getTime();
			fieldToVal.lastUpdated = unixTS;
			return ref.child(key).set(fieldToVal).then(() => getByKey(ref, key));
		}
	}
}
