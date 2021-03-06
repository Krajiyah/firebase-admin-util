/**
 * FCM entry point for firebase-admin-util
 * @module fcm
 */

module.exports = function(firebase) {

	const fcm = firebase.messaging();

	let send = async(dest, isDevice, title, message, data, isSilent) => {
		let options = {
			priority: "high"
		};
		if (isSilent) options.contentAvailable = true;
		let payload = {
			notification: {},
			data: data
		};
		if (!isSilent) {
			payload.notification = {
				title: title,
				body: message,
				icon: "icon_notification",
				sound: "default"
			}
		}
		if (isDevice)
			return await fcm.sendToDevice(dest, payload, options);
		return await fcm.sendToTopic(dest, payload, options);
	}

	/**
	 * Send push notification to device
	 *
	 * @async
	 * @function
	 * @param {string} token - The registration token from FCM.
	 * @param {string} title - The push notification title.
	 * @param {string} message - The push notification message.
	 * @param {object} [data] - The push notification payload.
	 * @return {Promise<object>} Same behavior as vanilla firebase admin sdk.
	 */
	let sendToDevice = async(token, title, message, data) => {
		return await send(token, true, title, message, data, false);
	}

	/**
	 * Send push notification to topic
	 *
	 * @async
	 * @function
	 * @param {string} topic - The subscription topic string.
	 * @param {string} title - The push notification title.
	 * @param {string} message - The push notification message.
	 * @param {object} [data] - The push notification payload.
	 * @return {Promise<object>} Same behavior as vanilla firebase admin sdk.
	 */
	let sendToTopic = async(topic, title, message, data) => {
		return await send(topic, false, title, message, data, false);
	}

	/**
	 * Send silent notification to device
	 *
	 * @async
	 * @function
	 * @param {string} token - The registration token from FCM.
	 * @param {object} data - The push notification payload.
	 * @return {Promise<object>} Same behavior as vanilla firebase admin sdk.
	 */
	let sendSilentToDevice = async(token, data) => {
		return await send(token, true, null, null, data, true);
	}

	/**
	 * Send silent notification to topic
	 *
	 * @async
	 * @function
	 * @param {string} topic - The subscription topic string.
	 * @param {object} data - The push notification payload.
	 * @return {Promise<object>} Same behavior as vanilla firebase admin sdk.
	 */
	let sendSilentToTopic = async(topic, data) => {
		return await send(topic, false, null, null, data, true);
	}

	return {
		sendToDevice: sendToDevice,
		sendToTopic: sendToTopic,
		sendSilentToDevice: sendSilentToDevice,
		sendSilentToTopic: sendSilentToTopic
	}
}
