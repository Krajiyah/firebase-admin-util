module.exports = function(firebase) {
	const fcm = firebase.messaging();

	let send = (dest, isDevice, title, message, data, isSilent) => {
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
			return fcm.sendToDevice(dest, payload, options);
		return fcm.sendToTopic(dest, payload, options);
	}

	return {
		sendToDevice: (token, title, message, data) => {
			return send(token, true, title, message, data, false);
		},
		sendToTopic: (topic, title, message, data) => {
			return send(topic, false, title, message, data, false);
		},
		sendSilentToDevice: (token, data) => {
			return send(token, true, null, null, data, true);
		},
		sendSilentToTopic: (topic, data) => {
			return send(topic, false, null, null, data, true);
		}
	}
}
