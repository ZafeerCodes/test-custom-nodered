const apiClient = {
    baseUrl: env.PERCEPTO_BACKEND_API_URL,
    token: null,
  
    setToken(token) {
      this.token = token;
    },
  
    get(endpoint, params = {}) {
      return $.ajax({
        type: 'GET',
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        data: params,
        dataType: 'json',
      });
    },
  
    post(endpoint, data = {}) {
      return $.ajax({
        type: 'POST',
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        data: JSON.stringify(data),
        contentType: 'application/json',
        dataType: 'json',
      });
    },
  
    put(endpoint, data = {}) {
      return $.ajax({
        type: 'PUT',
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        data: JSON.stringify(data),
        contentType: 'application/json',
        dataType: 'json',
      });
    },
  
    delete(endpoint, params = {}) {
      return $.ajax({
        type: 'DELETE',
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        data: params,
        dataType: 'json',
      });
    },
  };