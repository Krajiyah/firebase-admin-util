// // DEPENDENCIES
// var isUrl = require("is-url");
// var request = require("request");
//
// // CONSTANTS
// const invalidSchemaError = "Schema Invalid";
// const requireFirebaseError = "Operation Needs Firebase";
// const types = {
//   "link": (val) => typeof(val) == "string" && isUrl(val),
//   "ref": (val) => typeof(val) == "string",
//   "string": (val) => typeof(val) == "string",
//   "number": (val) => typeof(val) == "number",
//   "object": (val) => typeof(val) == "object" && !Array.isArray(val),
//   "array": (val) => typeof(val) == "object" && Array.isArray(val)
// };
// const integrityScore = {
//   ok: [.8, 1],
//   warning: [.5, .8],
//   danger: [0, .5]
// };
// const badMetrics = [
//   "missingFields", "extraFields", "incorrectTypes",
//   "brokenLinks", "brokenRefs"
// ];
// const goodMetrics = ["validTypes", "validLinks", "validRefs"];
// const neutralMetrics = ["totalNodes"];
//
// // OVERRIDES
// Object.values = (obj) => Object.keys(obj).map(key => obj[key]);
// Math.sum = (nums) => nums.reduce((sum, num, i, arr) => {
//   sum += num;
//   return sum;
// }, 0)
//
// // HELPERS
// let _throwInvalidSchema = () => {
//   return Promise.reject(new Error(invalidSchemaError));
// }
//
// let _throwNeedFirebase = () => {
//   return Promise.reject(new Error(requireFirebaseError));
// }
//
// let _aggAnd = (bool, b, i, arr) => bool && b;
//
// let _aggOr = (bool, b, i, arr) => bool || b;
//
// let _validKey = (firebase, key) => {
//   if (typeof(key) != "string")
//     return _throwInvalidSchema();
//   return firebase.database().ref().child(key).once("value")
//     .then(snapshot => {
//       if (!snapshot.exists())
//         return _throwInvalidSchema();
//       if (!types['object'](snapshot.val()) && !types['array'](snapshot.val()))
//         return _throwInvalidSchema();
//       return true;
//     });
// }
//
// let _validType = (val) => {
//   return Object.keys(types)
//     .map(type => types[type](val))
//     .reduce(_aggOr, false);
// }
//
// let _validFields = (fields) => {
//   return Object.keys(fields)
//     .map(field => _validType(fields[field]))
//     .reduce(_aggAnd, true)
// }
//
// let _getIntegrityStatus = (score) => {
//   var color = "danger";
//   Object.keys(integrityScore).forEach(c => {
//     let range = integrityScore[c];
//     if (range[0] <= score && range[1] >= score)
//       color = c;
//   });
//   return color;
// }
//
// let _validateSchema = (firebase, schema) => {
//   if (typeof(schema) != "object") return _throwInvalidSchema();
//   return Promise.all(Object.keys(schema)
//       .map(key => _validKey(firebase, key)))
//     .then(bools => bools.reduce(_aggAnd, true))
//     .then(cond1 => {
//       if (!cond1) return _throwInvalidSchema();
//       let cond2 = Object.values(schema)
//         .map(fields => _validFields(fields))
//         .reduce(_aggAnd, true)
//       if (!cond2) return _throwInvalidSchema();
//     });
// }
//
// let _initResult = () => {
//   var x = {
//     bad: {},
//     good: {},
//     neutral: {}
//   };
//   let initMetrics = (key, metrics) => {
//     metrics.forEach(metric => {
//       x[key][metric] = 0;
//     })
//   }
//   initMetrics("bad", badMetrics);
//   initMetrics("good", goodMetrics);
//   initMetrics("neutral", neutralMetrics);
//   return x;
// }
//
// let _checkRefField = (result, rootRef, ref, r, key) => {
//   return rootRef.child(r).child(key).once("value")
//     .then(snapshot => {
//       if (!snapshot.exists())
//         result[ref].bad.brokenRefs += 1;
//       else
//         result[ref].good.validRefs += 1;
//     });
// }
//
// let _checkLinkField = (result, ref, link) => {
//   return request(link, (err, res, body) => {
//     let code = String(res.statusCode)[0];
//     if (err || code == "4" || code == "5")
//       result[ref].bad.brokenLinks += 1;
//     else
//       result[ref].good.validLinks += 1;
//   });
// }
//
// let _objIntegrity = (result, rootRef, ref, subSchema, o) => {
//   Object.keys(o).forEach(field => {
//     if (!(field in subSchema))
//       result[ref].bad.extraFields += 1;
//   });
//   return Promise.all(Object.keys(subSchema).map(field => {
//     let type = subSchema[field];
//     let value = o[field];
//     var p = Promise.resolve(true);
//     if (!(field in o)) {
//       result[ref].bad.missingFields += 1;
//     } else if (type.indexOf("ref:") >= 0) {
//       let r = type.replace("ref:", "");
//       p = _checkRefField(result, rootRef, ref, r, value);
//     } else if (type == "link") {
//       p = _checkLinkField(result, ref, value);
//     } else if (!types[type](value)) {
//       result[ref].bad.incorrectTypes += 1;
//     }
//     result[ref].good.validTypes += 1;
//     return p;
//   }));
// }
//
// let _checkRefIntegrity = (result, rootRef, ref, subSchema) => {
//   return rootRef.child(ref).once("value").then(snapshot => {
//     result[ref] = _initResult();
//     result[ref].neutral.totalNodes = snapshot.numChildren();
//     var plist = [];
//     snapshot.forEach(childSnapshot => {
//       let o = childSnapshot.val();
//       plist.push(_objIntegrity(result, rootRef, ref, subSchema, o));
//     });
//     return Promise.all(plist);
//   });
// }
//
// let _integrity = (firebase, schema) => {
//   const rootRef = firebase.database().ref();
//   var result = {};
//   let refs = Object.keys(schema);
//   let plist = refs.map(ref => {
//     return _checkRefIntegrity(result, rootRef, ref, schema[ref]);
//   });
//   return Promise.all(plist).then(() => {
//     let sumDictVals = (dict) =>
//       Math.sum(Object.keys(dict).map(key => dict[key]));
//     let sumAllDictVals = (key) =>
//       Math.sum(Object.keys(result).map(ref => sumDictVals(result[ref][key])));
//     let good = sumAllDictVals("good");
//     let bad = sumAllDictVals("bad");
//     let score = good / (good + bad);
//     let integrity = _getIntegrityStatus(score);
//     var totals = _initResult();
//     let setTotals = (key, metrics) => {
//       metrics.forEach(metric => {
//         let x = 0;
//         Object.keys(result).forEach(ref => {
//           Object.keys(result[ref]).forEach(metricType => {
//             if (metric in result[ref][metricType])
//               x += result[ref][metricType][metric];
//           });
//         });
//         totals[key][metric] = x;
//       });
//     }
//     setTotals("good", goodMetrics);
//     setTotals("bad", badMetrics);
//     setTotals("neutral", neutralMetrics);
//     result.metrics = {
//       totals: totals,
//       score: score,
//       integrity: integrity
//     };
//     return result;
//   });
// }
//
// // METHODS
// let obj = {
//   use: (firebase) => {
//     this.firebase = firebase;
//   },
//   schema: (schema) => {
//     this.schema = schema;
//   },
//   run: () => {
//     if (!this.firebase) return _throwNeedFirebase();
//     if (!this.schema) return _throwInvalidSchema();
//     return _validateSchema(this.firebase, this.schema).then(() => {
//       return _integrity(this.firebase, this.schema);
//     });
//   }
// }
//
// // EXPORTS
// module.exports = obj;
