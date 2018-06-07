/**
 * Listener class (used by FirebaseObject for real time listeners)
 */
class Listener {

  /**
   * Create a Listener
   * @constructor
   * @param {object} ref - The database reference.
   * @param {boolean} isChild - Set to true if its a single object listener, otherwise set to false for whole node listeners
   * @param {function} cb - callback for listener
   * @param {boolean} [once] - set to true if you want to only call the listener once
   */
  constructor(ref, isChild, cb, once) {
    this._ref = ref;
    this._isChild = isChild;
    this._cb = cb;
    this._once = once;
  }

  /**
   * Listen for changes
   */
  listen() {
    let removeType = this._isChild === true ? "child_removed" : "removed";
    let addType = this._isChild === true ? "child_added" : "added";
    let changeType = this._isChild === true ? "child_changed" : "changed";
    let removeCb = this._cb(removeType);
    let addCb = this._cb(addType);
    let changeCb = this._cb(changeType);
    if (this._once) {
      this._called = false;
      const that = this;
      let onceify = (ev, callback) => {
        return async snapshot => {
          that._called = await callback(snapshot);
          if (that._called) that._ref.off(ev);
        }
      }
      this._ref.on("child_removed", onceify("child_removed", removeCb));
      this._ref.on("child_added", onceify("child_added", addCb));
      this._ref.on("child_changed", onceify("child_changed", changeCb));
    } else {
      this._ref.on("child_removed", removeCb);
      this._ref.on("child_added", addCb);
      this._ref.on("child_changed", changeCb);
    }
  }
}

module.exports = Listener;
