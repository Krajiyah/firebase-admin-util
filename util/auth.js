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
    deleteAuthAccount: uid => auth.deleteUser(uid),
    createAuthAccount: (email, password) => {
      return auth.createUser({
        email: email,
        emailVerified: false,
        password: password,
        disabled: false
      });
    },
    updateAuthAccount: (uid, info) => auth.updateUser(uid, info)
  }
}
