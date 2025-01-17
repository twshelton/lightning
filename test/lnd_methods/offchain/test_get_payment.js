const EventEmitter = require('events');

const {test} = require('@alexbosworth/tap');

const {getPayment} = require('./../../../');

const makeLnd = args => {
  return {
    router: {
      trackPaymentV2: ({}) => {
        const data = args.data || {status: 'IN_FLIGHT'};
        const emitter = new EventEmitter();

        if (!!args.is_end) {
          process.nextTick(() => emitter.emit('end'));
        } else if (!!args.err) {
          process.nextTick(() => emitter.emit('error', args.err));
        } else {
          process.nextTick(() => emitter.emit('data', data));
        }

        return emitter;
      },
    },
  };
};

const makeArgs = overrides => {
  const args = {
    id: Buffer.alloc(32).toString('hex'),
    lnd: makeLnd({}),
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const makeExpectedPayment = ({}) => {
  return {
    failed: undefined,
    is_confirmed: true,
    is_failed: false,
    is_pending: false,
    payment: {
      fee: 0,
      fee_mtokens: '1',
      hops: [{
        channel: '0x0x1',
        channel_capacity: 1,
        fee: 0,
        fee_mtokens: '1',
        forward: 0,
        forward_mtokens: '1',
        public_key: 'b',
        timeout: 1,
      }],
      id: '66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925',
      paths: [{
        fee: 0,
        fee_mtokens: '1',
        hops: [{
          channel: '0x0x1',
          channel_capacity: 1,
          fee: 0,
          fee_mtokens: '1',
          forward: 0,
          forward_mtokens: '1',
          public_key: 'b',
          timeout: 1
        }],
        mtokens: '1',
        safe_fee: 1,
        safe_tokens: 1,
        timeout: 1,
        tokens: 0,
      }],
      mtokens: '1',
      safe_fee: 1,
      safe_tokens: 1,
      secret: Buffer.alloc(32).toString('hex'),
      timeout: 1,
      tokens: 0,
    },
  };
};

const makeLegacyConfirmed = ({}) => {
  return {
    htlcs: [],
    preimage: Buffer.alloc(32),
    route: {
      hops: [{
        amt_to_forward_msat: '1',
        chan_capacity: '1',
        chan_id: '1',
        expiry: 1,
        fee_msat: '1',
        pub_key: 'b',
      }],
      total_amt_msat: '1',
      total_fees_msat: '1',
      total_time_lock: 1,
    },
    state: 'SUCCEEDED',
  };
};

const tests = [
  {
    args: makeArgs({id: undefined}),
    description: 'The id of a past payment is required',
    error: [400, 'ExpectedPaymentHashToLookupPastPaymentStatus'],
  },
  {
    args: makeArgs({lnd: undefined}),
    description: 'LND is required',
    error: [400, 'ExpectedLndGrpcApiObjectToLookupPayment'],
  },
  {
    args: makeArgs({
      lnd: makeLnd({err: {details: `payment isn't initiated`}}),
    }),
    description: 'A payment not found returns an error',
    error: [404, 'SentPaymentNotFound'],
  },
  {
    args: makeArgs({lnd: makeLnd({err: 'err'})}),
    description: 'Unexpected errors are returned',
    error: [503, 'UnexpectedGetPaymentError', {err: 'err'}],
  },
  {
    args: makeArgs({
      lnd: makeLnd({err: {details: `payment isn't initiated`}}),
    }),
    description: 'Unexpected errors are returned',
    error: [404, 'SentPaymentNotFound'],
  },
  {
    args: makeArgs({}),
    description: 'An in-progress payment is returned',
    expected: {
      payment: {
        failed: undefined,
        is_confirmed: false,
        is_failed: false,
        is_pending: true,
        payment: undefined,
      },
    },
  },
  {
    args: makeArgs({lnd: makeLnd({is_end: true})}),
    description: 'A nothing result is returned',
    error: [503, 'UnknownStatusOfPayment'],
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async ({end, rejects, strictSame}) => {
    if (!!error) {
      await rejects(() => getPayment(args), error, 'Got expected error');
    } else {
      const payment = await getPayment(args);

      strictSame(payment, expected.payment, 'Got expected payment');
    }

    return end();
  });
});
