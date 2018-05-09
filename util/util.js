var toString = (modelName, obj) => {
  return modelName + " " + JSON.stringify({
    _event: obj._event,
    _ref: obj._ref.toString(),
    _key: obj._key,
    _value: obj._value
  }, null, 2);
}

module.exports.toString = toString;
