import * as React from 'react';
import 'isomorphic-fetch';
import { render } from 'react-dom';
import { Provider } from 'react-redux';
import { AppContainer } from 'react-hot-loader';
import store from '../client/store';
import App from './App';
import { BrowserRouter as Router} from "react-router-dom";


function renderApp() {
  render(
    <AppContainer>
      <Provider store={store}>
      	<Router>
        	<App />
        </Router>
      </Provider>
    </AppContainer>,
    document.getElementById('root')
  );
}

renderApp();

if (module.hot) {
  module.hot.accept();
}
