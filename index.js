// DEPENDENCIES
const db = require("./util/db.js");
const auth = require("./util/auth.js");
const storage = require("./util/storage.js");
const fcm = require("./util/fcm.js");

// EXPORTS
module.exports = (firebase, schema) => {
  return {
    db: db(firebase, schema),
    auth: auth(firebase),
    storage: storage(firebase),
    fcm: fcm(firebase)
  }
}
