module.exports = {
  // ... other config ...
  resolve: {
    extensions: ['.js', '.jsx']  // Add .jsx
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,  // Add .jsx
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      }
    ]
  }
}; 