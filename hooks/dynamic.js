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
			var event = request.payload;

			// ignore all events except customer creation
			if (
				!('type' in event) ||
				!/^customer\.(cre|upd)ated$/.test(event.type)
			) {
				return reply( null, 'event ignored' );
			}

			var username = event.data.object.metadata.hoodieId;

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
					'customerId' in userDoc &&
					event.type === 'customer.created'
				) {
					return reply(new Error(
						'user already linked to customer: ' + userDoc.customerId
					));
				}

				userDoc.customerId = event.data.object.id;

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
