import React, { Component} from 'react';
import { connect } from 'react-redux';
import { Page, Layout, Stack, Card, TextField, Button } from '@shopify/polaris';
import {AccountConnection, Link} from '@shopify/polaris';

class Account extends Component {
  constructor(props) {
    super(props)
    this.state = {
      connected: false,
      accountName: ''
    }
  }

  async connect() {
    try {
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        credentials: 'include',
      }

      const account = await fetch('/api/connect', fetchOptions)
      
    } catch (err) {
      console.log(err)
    }


    // this.setState((state) => {
    //   const connected = !state.connected;
    //   const accountName = connected ? 'Jane Appleseed' : '';

    //   return {
    //     connected,
    //     accountName,
    //   };
    // });
  };
  render() {
    const {accountName, connected} = this.state;
    const buttonText = connected ? 'Disconnect' : 'Connect';
    const details = connected ? 'Account connected' : 'No account connected';
    const terms = connected ? null : (
      <p>
        By clicking <strong>Connect</strong>, you agree to accept Starchain’s{' '}
        <Link url="Example App">terms and conditions</Link>.
      </p>
    );

    return (
      <Page
        title="Account"
      >
        <Layout sectioned>
          <AccountConnection
            accountName={accountName}
            connected={connected}
            title="Starchain"
            action={{
              content: buttonText,
              onAction: this.connect.bind(this),
            }}
            details={details}
            termsOfService={terms}
          />
        </Layout>
      </Page>
    )
  }

}

function mapStateToProps({
  requestFields,
  requestInProgress,
  requestError,
  responseBody,
}) {
  return {
    requestFields,
    requestInProgress,
    requestError,
    responseBody,
  };
}

export default connect(mapStateToProps)(Account);
