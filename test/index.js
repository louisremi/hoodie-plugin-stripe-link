import { describe, it } from 'mocha';
import { expect } from 'chai';
import fetch from 'node-fetch';

const HOODIE_URL = 'http://localhost:8888';

function randomSignUp() {
	const username = 'u' + Math.round( Math.random() * 1E9 );
	const password = 'p' + Math.round( Math.random() * 1E9 );
	const hoodieId = Math.random().toString().substr(2);
	const userUrl = `org.couchdb.user:user/${username}`;

	return fetch(`${HOODIE_URL}/_api/_users/${encodeURIComponent(userUrl)}`, {
		method: 'put',
		headers: {
			'Content-Type': 'application/json',
			'Accept': 'application/json',
		},
		body: JSON.stringify({
			_id: userUrl,
			name: 'user/' + username,
			type: 'user',
			roles: [],
			password,
			hoodieId,
			database: 'user/' + hoodieId,
			updatedAt: new Date(),
			createdAt: new Date(),
			signedUpAt: new Date(),
      stripe: {},
		}),
	})
	.then(r => r.json())
  .then((response) => {
    if(!response.ok) {
      throw new Error("Couldn't register new random user");
    }
    return {
      username,
      password,
      hoodieId,
      userUrl,
    }
  });
}

describe('Username existence', () => {
  const usernameExist = (username) => {
    return fetch(`${HOODIE_URL}/_api/_plugins/stripe-link/_api`, {
      method: 'post',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username}),
    })
    .then(r => r.json());
  }

  let user = null;
  before((done) => {
    randomSignUp()
      .then((hoodieUser) => {
        user = hoodieUser;
        done();
      })
      .catch(done);
  });

  it('should reply false if looking for random username', (done) => {
    usernameExist('u' + Math.round(Math.random() * 1E9))
		.then(({isExisting}) => {
      expect(isExisting).to.equal(false);
      done();
    }).catch(e => done(e));
  });

  it('should reply true when looking for actual username', (done) => {
    usernameExist(user.username)
		.then(({isExisting}) => {
      expect(isExisting).to.equal(true);
      done();
    }).catch(e => done(e));
  });

});

describe('Webhook Stripe', () => {
  let defaultEvent = {
    object: {
      "data": {
        "object": {
          "customer": `cus_${Math.round(Math.random() * 1E9)}`,
          "metadata": {}
        },
      },
      "type": "customer.created",
    }
  };

  // beforeEach to avoid update conflicts
  beforeEach((done) => {
    randomSignUp()
      .then((hoodieUser) => {
        defaultEvent.object.data.object.metadata.hoodieId = hoodieUser.username;
        done();
      })
      .catch(done);
  });

  const sendEvent = (eventName = 'customer.created') => {
    defaultEvent.object.type = eventName;
    return fetch(`${HOODIE_URL}/_api/_plugins/stripe-link/_api`, {
      method: 'post',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(defaultEvent),
    })
    .then(r => r.text());
  };

  it('should reply success if the event is customer.created', (done) => {
    sendEvent('customer.created')
      .then((response) => {
        expect(response).to.equal('success');
        done();
      })
      .catch(done)
  });

  it('should reply success if the event is customer.updated', (done) => {
    sendEvent('customer.updated')
      .then((response) => {
        expect(response).to.equal('success');
        done();
      })
      .catch(done)
  });

  it('should ignore any other events', (done) => {
    sendEvent('charge.succeeded')
      .then((response) => {
        expect(response).to.equal('event ignored');
        done();
      })
      .catch(done)
  });

});
