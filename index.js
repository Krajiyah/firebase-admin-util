/**
 * @overview Documentation for firebase-admin-util
 * @author Krishnan Rajiyah <krajiyah@gmail.com>
 */

// DEPENDENCIES
const db = require("./util/db.js");
const auth = require("./util/auth.js");
const storage = require("./util/storage.js");
const fcm = require("./util/fcm.js");

/**
 * Main entry point for firebase-admin-util
 * @module index
 */

/**
 * Firebase Admin Util
 * @param {object} firebase - Firebase Admin SDK instance
 * @param {object} schema - Database schema for object mapping
 * @example
 * // Example schema (showing usage of all types)
 * let schema = {
   "User": {
       "path": "Users",
       "fields": {
         "name": "string",
         "image": "link",
         "age": "number",
         "isAdmin": "boolean",
         "meta": "object",
         "dogs": "array:Dogs", // array of keys to Dog objects
         "cat": "string:Cats" // key to Cat object
       }
   }
 };
 * @example
 * // Example schema (showing nested nodes as path)
 * let schema = {
   "Dog": {
     "path": "SomeNode/SomeNode/Dogs",
     "fields": {
       "name": "string",
       "user": "string:Users"
     }
   },
   "Cat": {
     "path": "SomeNode/Cats",
     "fields": {
       "name": "string",
       "user": "string:Users"
     }
   }
 };
 */
module.exports = (firebase, schema) => {
  return {
    db: db(firebase, schema),
    auth: auth(firebase),
    storage: storage(firebase),
    fcm: fcm(firebase)
  }
}
