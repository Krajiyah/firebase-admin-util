module.exports = function(firebase) {
  const auth = firebase.auth();
  return {
    assertEmailNotTaken: email => {
      return auth.getUserByEmail(email).catch(error => {})
        .then(userRecord => {
          if (userRecord && userRecord.uid)
            return Promise.reject(new Error("Email is taken"));
        });
    },
    delete: uid => auth.deleteUser(uid),
    create: (email, password) => {
      return auth.createUser({
        email: email,
        emailVerified: false,
        password: password,
        disabled: false
      });
    },
    update: (uid, info) => auth.updateUser(uid, info)
  }
}
