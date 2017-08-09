var request = require('request');
var uuid = require('uuid');

module.exports = connect;
function connect(opts, cb) {
	if (typeof opts === 'function') {
		cb = opts;
		opts = {};
	}
	let settings = Object.assign({}, {
		proto: 'http',
		addr: 80,
		region: 'us',
		apiUrl: 'http://127.0.0.1:4040',
		name: uuid.v4().toString()
	}, opts);

	const api = request.defaults({
		baseUrl: settings.apiUrl,
		json: true
	});

	runTunnel(settings, (err, tunnel) => {
		if (err) return cb(err);
		settings.publicUrl = tunnel.publicUrl;
		settings.tunnelUri = tunnel.uri;
		settings.disconnect = disconnect;
		return cb(null, settings);
	});

	function runTunnel(settings, cb) {
		var retries = 100;
		var retry = function () {
			api.post(
				{ url: 'api/tunnels', json: settings },
				function (err, resp, body) {
					if (err) return cb(err);
					
					var notReady = resp.statusCode === 500 && /panic/.test(body) ||
						resp.statusCode === 502 && body.details &&
						body.details.err === 'tunnel session not ready yet';

					if (notReady) {
						return retries-- ?
							setTimeout(retry, 200) :
							cb(new Error(body));
					}
					var publicUrl = body && body.public_url;
					if (!publicUrl) {
						var err = Object.assign(new Error(body.msg || 'failed to start tunnel'), body);
						return cb(err);
					}
					return cb(null, { publicUrl, uri: body.uri });
				});
		};

		retry();
	}

	function disconnect(cb) {
		cb = cb || function () { };
		return api.del(
			settings.tunnelUri,
			function (err, resp, body) {
				if (err || resp.statusCode !== 204) {
					return cb(err || new Error(body));
				}
				return cb();
			});
	}
}

