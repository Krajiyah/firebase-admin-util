# firebase-admin-util

## Notes
1. schema must be in following format:
```json
{
  "userRef": "Users",
  "someSubRef": "Parent/Child",
  "someNestedRef": "Parent/Child/ChildSChild"
}
```

2. Model classes should look like this:
```js
const FirebaseObject = require("firebase-admin-util")(firebase, schema).FirebaseObject;
// or import FirebaseObject some other way

class Users extends FirebaseObject {
  constructor(snapshot) {
    super(FirebaseObject.refs.userRef, snapshot)
  }
  someUserLogicMethod(a, b, c) {
    // do stuff here
  }
}
```
