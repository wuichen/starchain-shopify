import React, { Component } from 'react';
import { Page, AppProvider } from '@shopify/polaris';
import { Route, Switch } from "react-router-dom";
import ApiConsole from './containers/ApiConsole'
import Account from './containers/Account'
import test from './containers/test'

class App extends Component {
  async do() {

  }
  render() {
    const { apiKey, shopOrigin } = window;

    return (
      <AppProvider shopOrigin={shopOrigin} apiKey={apiKey}>
        <Switch>
          <Route exact path="/account" component={Account} />
          <Route exact path="/" component={Account} />
          <Route exact path="/apiconsole" component={ApiConsole} />
          <Route path="/test" component={test} />
        </Switch>
      </AppProvider>
    );
  }
}

export default App;
