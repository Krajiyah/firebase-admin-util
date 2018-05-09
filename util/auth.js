/**
 * Auth entry point for firebase-admin-util
 * @module auth
 */

module.exports = function(firebase) {

  const auth = firebase.auth();

  /**
   * Assert email is not taken by another user
   *
   * @async
   * @function
   * @param {string} email - The email to check against.
   * @return {Promise<boolean>} True iff assertion passed, throws error otherwise
   */
  let assertEmailNotTaken = async email => {
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (e) {
      return true;
    }
    if (userRecord && userRecord.uid)
      throw new Error("Email is taken");
    return true;
  }

  /**
   * Delete a user from auth records.
   *
   * @async
   * @function
   * @param {string} uid - The uid of an existing user that you want to delete.
   * @return {Promise<object>} Same behavior as vanilla firebase admin sdk.
   */
  let deleteUser = async uid => await auth.deleteUser(uid);

  /**
   * Create a user auth record.
   *
   * @async
   * @function
   * @param {string} email - The email for the user.
   * @param {string} password - The password for the user.
   * @return {Promise<object>} Same behavior as vanilla firebase admin sdk.
   */
  let createUser = async(email, password) => await auth.createUser({
    email: email,
    emailVerified: false,
    password: password,
    disabled: false
  });

  /**
   * Update a user auth record.
   *
   * @async
   * @function
   * @param {string} uid - The uid of an existing user that you want to update.
   * @param {object} info - The user info you want to update the user record with (same as vanilla firebase admin sdk).
   * @return {Promise<object>} Same behavior as vanilla firebase admin sdk.
   */
  let updateUser = async(uid, info) => await auth.updateUser(uid, info);

  return {
    assertEmailNotTaken: assertEmailNotTaken,
    deleteUser: deleteUser,
    createUser: createUser,
    updateUser: updateUser
  }
}
