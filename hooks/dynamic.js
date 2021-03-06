var promisify = require('es6-promisify')

/*
	Hooks allow you to alter the behaviour of hoodie-server,
	Hoodie’s core backend module.

	This is possible:
	- get a notification when something in hoodie-server happens
	- extend core features of hoodie-server from a plugin

	A hook is defined as a function that takes a number of arguments
	and possibly a return value. Each hook has its own conventions,
	based on where in hoodie-server it hooks into.

	There are fundamentally two types of hooks:
	- static hooks (see static.js)
	- dynamic hooks (this file)

	The core difference is that static hooks work standalone and just
	receive a number of arguments and maybe return a value. Dynamic
	hooks get initialised with a live instance of the hoodie object,
	that is also available in worker.js, with access to the database,
	and other convenience libraries.
*/
module.exports = function( hoodie ) {
	return {
		/*
			group: server.api.*
			description: The server.api group allows you to extend the
				/_api endpoint from hoodie-server.
		*/
		/*
			name: server.api.plugin-request
			description: This hook handles any request to
				`/_api/_plugins/{pluginname}/_api`.
				(omitting the hoodie-plugin- prefix in the plugin name)
				It gets the regular hapi request & reply objects as parameters.
				See http://hapijs.com/api#request-object
				and http://hapijs.com/api#reply-interface
				for details.

			parameters:
			- request: the hapi request object
			- reply: the hapi reply object

			return value: boolen
				false determines that the hook didn’t run successfully and
				cuses Hoodie to return a 500 error.
		*/
		'server.api.plugin-request': function(request, reply) {
			// handle username exist requests
			if (request.payload && 'username' in request.payload) {
				return promisify(
					hoodie.account.find
				)(
					'user',
					request.payload.username
				)
				.then(function() {
					reply( null, { isExisting: true });
				})
				.catch(function( error ) {
					if ( error.error === 'not_found' ) {
						reply( null, { isExisting: false });
					}
					else {
						reply( error );
					}
				});
			}

			var event = request.payload;

			// ignore all events except customer create and update
			if (
				!('type' in event) ||
				!/^customer\.(cre|upd)ated$/.test(event.type)
			) {
				return reply( null, 'event ignored' );
			}

			var object = event.data.object;
			var username = object.metadata.username || object.email;

			if ( !username ) {
				return reply(new Error(
					'metadata.hoodieId missing, can\'t link user to customer'
				));
			}

			hoodie.account.find('user', username, function(error, userDoc) {
				if (error) {
					return reply(new Error(error));
				}

				// In case of race conditions, don't overwrite the initial
				// customerId
				if (
					'stripe' in userDoc &&
					'customerId' in userDoc.stripe &&
					event.type === 'customer.created'
				) {
					return reply(new Error(
						'user already linked to customer: ' + userDoc.stripe.customerId
					));
				}

				userDoc.stripe = { customerId: event.data.object.id };

				hoodie.account.update('user', username, userDoc, function(error) {
					if (error) {
						return reply(new Error(error));
					}

					reply( null, 'success' );
				});
			});
		}
	};
};
