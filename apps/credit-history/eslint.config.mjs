import config from '@acta-products/config/eslint/next';

const creditHistoryConfig = [
  ...config,
  {
    rules: {
      // getCredentialSource() with zero arguments silently falls back to mock
      // fixtures even when NEXT_PUBLIC_DATA_SOURCE=real — every call site must
      // go through useCredentialSource() (session-gated surfaces) or pass an
      // explicit options object (e.g. { client } when owner is legitimately
      // unresolved, as in the public verifier). See issue on credential
      // source consistency across /credentials, /vault and /share.
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='getCredentialSource'][arguments.length=0]",
          message:
            'getCredentialSource() must never be called with zero arguments — use useCredentialSource() or pass an explicit options object.',
        },
      ],
    },
  },
];

export default creditHistoryConfig;
