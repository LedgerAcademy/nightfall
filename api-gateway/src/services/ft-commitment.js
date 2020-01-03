import { whisperTransaction } from './whisper';
import { accounts, db, offchain, zkp } from '../rest';

/**
 * This function will insert FT commitment in database
 * req.user {
    address: '0x04b95c76d5075620a655b707a7901462aea8656d',
    name: 'alice',
    ownerPublicKey: '0x4c45963a12f0dfa530285fde66ac235c8f8ddf8d178098cdb292ac',
    password: 'alicesPassword'
 }
 * req.body {
    amount: 0x0000002,
    salt: '0xE9A313C89C449AF6E630C25AB3ACC0FC3BAB821638E0D55599B518',
    commitment: '0xdd3434566',
    commitmentIndex: 1,
    isReceived: true,
    zCorrect: true,
    zOnchainCorrect: true,
  }
 * @param {*} req
 * @param {*} res
 */
export async function insertFTCommitmentToDb(req, res, next) {
  try {
    res.data = await db.insertFTCommitment(req.user, req.body);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * This function will fetch FT commitments from database
 * req.user {
    address: '0x04b95c76d5075620a655b707a7901462aea8656d',
    name: 'alice',
    ownerPublicKey: '0x4c45963a12f0dfa530285fde66ac235c8f8ddf8d178098cdb292ac',
    password: 'alicesPassword'
 }
 * req.query {
    pageNo: 1,
    limit: 4
  }
 * @param {*} req
 * @param {*} res
 */
export async function getFTCommitments(req, res, next) {
  try {
    res.data = await db.getFTCommitments(req.user, req.query);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * This function will fetch FT commitment transactions from database
 * req.user {
    address: '0x04b95c76d5075620a655b707a7901462aea8656d',
    name: 'alice',
    ownerPublicKey: '0x4c45963a12f0dfa530285fde66ac235c8f8ddf8d178098cdb292ac',
    password: 'alicesPassword'
 }
 * req.query {
    pageNo: 1,
    limit: 4
  }
 * @param {*} req
 * @param {*} res
 */
export async function getFTCommitmentTransactions(req, res, next) {
  try {
    res.data = await db.getFTCommitmentTransactions(req.user, req.query);
    next();
  } catch (err) {
    next(err);
  }
}

export async function checkCorrectnessForFTCommitment(req, res, next) {
  try {
    res.data = await zkp.checkCorrectnessForFTCommitment(req.headers, req.body);
    next();
  } catch (err) {
    next(err);
  }
}

// ERC-20 commitment
/**
 * This function will mint a coin and add transaction in db
 * req.user {
    address: '0x3bd5ae4b9ae233843d9ccd30b16d3dbc0acc5b7f',
    name: 'alice',
    ownerPublicKey: '0x70dd53411043c9ff4711ba6b6c779cec028bd43e6f525a25af36b8',
    password: 'alicesPassword'
  }
 * req.body {
    amount: '0x00000000000000000000000000002710',
  }
 * @param {*} req
 * @param {*} res
 */
export async function mintFTCommitment(req, res, next) {
  const { amount } = req.body;
  try {
    const data = await zkp.mintFTCommitment(req.user, {
      amount,
      ownerPublicKey: req.user.ownerPublicKey,
    });

    data.commitmentIndex = parseInt(data.commitmentIndex, 16);

    const { salt, commitment, commitmentIndex } = data;

    await db.insertFTCommitment(req.user, {
      amount,
      salt,
      commitment,
      commitmentIndex,
      isMinted: true,
    });

    res.data = data;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * This function will transfer a coin and update db
 * req.user {
    address: '0x3bd5ae4b9ae233843d9ccd30b16d3dbc0acc5b7f',
    name: 'alice',
    ownerPublicKey: '0x70dd53411043c9ff4711ba6b6c779cec028bd43e6f525a25af36b8',
    password: 'alicesPassword'
  }
 * req.body {
    firstFTCommitment: {
      amount: '0x00000000000000000000000000002710',
      salt: '0x14de022c9b4a437b346f04646bd7809deb81c38288e9614478351d',
      commitmentIndex: 0,
      commitment: '0x39aaa6fe40c2106f49f72c67bc24d377e180baf3fe211c5c90e254'
    },
    secondFTCommitment: {
      amount: '0x00000000000000000000000000001388',
      salt: '0xdd22d29b452a36d4f9fc3b2ad00e9034cc0a4175b52aa35fb7cd92',
      commitmentIndex: 1,
      commitment: '0x0ca8040181b3fc505eed1ee6892622054ae877ddf8f9dafe93b072'
    },
    transferredAmount: '0x00000000000000000000000000001770',
    changeAmount: '0x00000000000000000000000000002328',
    ownerPublicKey: '0x70dd53411043c9ff4711ba6b6c779cec028bd43e6f525a25af36b8',
    receiver: 'bob'
  }
 * @param {*} req
 * @param {*} res
 */
export async function transferFTCommitment(req, res, next) {
  try {
    // Generate a new one-time-use Ethereum address for the sender to use
    const password = (req.user.address + Date.now()).toString();
    const address = (await accounts.createAccount(password)).data;
    await db.updateUserWithPrivateAccount(req.user, { address, password });
    await accounts.unlockAccount({ address, password });

    req.body.receiverPublicKey = await offchain.getZkpPublicKeyFromName(req.body.receiver); // fetch publicKey from PKD by passing username

    // get logged in user's secretkey.
    const user = await db.fetchUser(req.user);
    req.body.senderSecretKey = user.secretkey;
    const data = await zkp.transferFTCommitment({ address }, req.body);
    data.transferredCommitmentIndex = parseInt(data.transferredCommitmentIndex, 16);
    data.changeCommitmentIndex = parseInt(data.changeCommitmentIndex, 16);

    const { transferredAmount, changeAmount, receiver } = req.body;
    let { amount, salt, commitmentIndex, commitment } = req.body.firstFTCommitment;
    const {
      transferredCommitment,
      transferredCommitmentIndex,
      changeCommitment,
      changeCommitmentIndex,
      transferredSalt,
      changeSalt,
    } = data;

    // update slected coin1 with tansferred data
    await db.updateFTCommitmentByCommitmentHash(req.user, commitment, {
      amount,
      salt,
      commitment,
      commitmentIndex,
      transferredAmount,
      transferredSalt,
      transferredCommitment,
      transferredCommitmentIndex,
      changeAmount,
      changeSalt,
      changeCommitment,
      changeCommitmentIndex,
      receiver,
      isTransferred: true,
    });

    ({ amount, salt, commitmentIndex, commitment } = req.body.secondFTCommitment);

    // update slected coin with tansferred data
    await db.updateFTCommitmentByCommitmentHash(req.user, commitment, {
      amount,
      salt,
      commitment,
      commitmentIndex,
      transferredAmount,
      transferredSalt,
      transferredCommitment,
      transferredCommitmentIndex,
      changeAmount,
      changeSalt,
      changeCommitment,
      changeCommitmentIndex,
      receiver,
      isTransferred: true,
    });

    // transfer is only case where we need to call api to add coin transaction
    // rest of case inserting coin or updating coin will add respective transfer log.
    await db.insertFTCommitmentTransaction(req.user, {
      amount: transferredAmount,
      salt: transferredSalt,
      commitment: transferredCommitment,
      commitmentIndex: transferredCommitmentIndex,
      changeAmount,
      changeSalt,
      changeCommitment,
      changeCommitmentIndex,
      receiver,
      isTransferred: true,
      usedFTCommitments: [
        {
          amount: req.body.firstFTCommitment.amount,
          commitment: req.body.firstFTCommitment.commitment,
        },
        {
          amount,
          commitment,
        },
      ],
    });

    // add change to user database
    if (parseInt(changeAmount, 16)) {
      await db.insertFTCommitment(req.user, {
        amount: changeAmount,
        salt: changeSalt,
        commitment: changeCommitment,
        commitmentIndex: changeCommitmentIndex,
        isChange: true,
      });
    }

    // note:
    // transferredAmount is the value transferred to the receiver
    // changeAmount is the value returned as 'change' to the sender
    await whisperTransaction(req, {
      amount: transferredAmount,
      salt: transferredSalt,
      publicKey: req.body.receiverPublicKey,
      commitment: transferredCommitment,
      commitmentIndex: transferredCommitmentIndex,
      blockNumber: data.txReceipt.receipt.blockNumber,
      receiver,
      for: 'FTCommitment',
    });

    res.data = data;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * This function will burn a coin
 * req.body {
  amount: '0x00000000000000000000000000000001',
  salt: '0xa31adb1074f977413fddd3953e333529a3494e110251368cc823fb',
  commitmentIndex: 0,
  commitment: '0x1ec4a9b406fd3d79a01360ccd14c8530443ea9869f8e9560dafa56',
  payTo: 'bob',
 }
 * @param {*} req
 * @param {*} res
 */
export async function burnFTCommitment(req, res, next) {
  try {
    const payToAddress = req.body.payTo
      ? await offchain.getAddressFromName(req.body.payTo)
      : req.user.address;

    const user = await db.fetchUser(req.user);
    req.body.receiverSecretKey = user.secretkey; // get logged in user's secretkey.
    const { amount, receiverSecretKey, salt, commitment, commitmentIndex, payTo } = req.body;

    const burnFTCommitmentBody = {
      amount,
      receiverSecretKey,
      salt,
      commitment,
      commitmentIndex,
      receiver: payTo || req.user.name,
    };
    res.data = await zkp.burnFTCommitment(
      { ...burnFTCommitmentBody, payTo: payToAddress },
      req.user,
    );

    // update slected coin2 with tansferred data
    await db.updateFTCommitmentByCommitmentHash(req.user, req.body.commitment, {
      amount,
      salt,
      commitment,
      commitmentIndex,
      receiver: payTo || req.user.name,
      isBurned: true,
    });

    if (payTo) {
      await whisperTransaction(req, {
        amount: Number(amount),
        shieldContractAddress: user.selected_ftoken_shield_contract,
        receiver: payTo,
        sender: req.user.name,
        senderAddress: req.user.address,
        blockNumber: res.data.txReceipt.receipt.blockNumber,
        for: 'FToken',
      }); // send ft token data to BOB side
    } else {
      await db.insertFTTransaction(req.user, {
        amount: Number(amount),
        shieldContractAddress: user.selected_ftoken_shield_contract,
        receiver: payTo,
        sender: req.user.name,
        senderAddress: req.user.address,
        isReceived: true,
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * This function will do batch fungible commitment transfer
 * req.user {
    address: '0x3bd5ae4b9ae233843d9ccd30b16d3dbc0acc5b7f',
    name: 'alice',
    ownerPublicKey: '0x70dd53411043c9ff4711ba6b6c779cec028bd43e6f525a25af36b8',
    password: 'alicesPassword'
  }
 * req.body {
    "amount": "0x00000000000000000000000000000028",
    "salt": "0x75f9ceee5b886382c4fe81958da985cd812303b875210b9ca2d75378bb9bd801",
    "commitment": "0x00000000008ec724591fde260927e3fcf85f039de689f4198ee841fcb63b16ed",
    "commitmentIndex": 21,
    "transferData": [
      {
        "value": "0x00000000000000000000000000000002",
        "receiverName": "b"
      },
      {
        "value": "0x00000000000000000000000000000002",
        "receiverName: "a"
      }
    ]
  }
 * @param {*} req
 * @param {*} res
 */
export async function simpleFTCommitmentBatchTransfer(req, res, next) {
  let changeIndex;
  let changeData = [{}];

  try {
    // Generate a new one-time-use Ethereum address for the sender to use
    const password = (req.user.address + Date.now()).toString();
    const address = (await accounts.createAccount(password)).data;
    await db.updateUserWithPrivateAccount(req.user, { address, password });
    await accounts.unlockAccount({ address, password });

    // get logged in user's secretkey.
    const user = await db.fetchUser(req.user);
    req.body.senderSecretKey = user.secretkey;

    const { amount, salt, commitment, commitmentIndex, transferData } = req.body;
    let selectedCommitmentValue = Number(req.body.amount); // amount of selected commitment

    for (const data of transferData) {
      /* eslint-disable no-await-in-loop */
      data.receiverPublicKey = await offchain.getZkpPublicKeyFromName(data.receiverName); // fetch publicKey from PKD by passing username
      selectedCommitmentValue -= Number(data.value);
    }

    if (selectedCommitmentValue < 0)
      throw new Error('Transfer value exceeds selected commitment amount');

    for (let i = transferData.length; i < 20; i++) {
      if (selectedCommitmentValue) changeIndex = i; // array index where change amount is added

      transferData[i] = {
        value: `0x${selectedCommitmentValue.toString(16).padStart(32, 0)}`,
        receiverPublicKey: req.user.ownerPublicKey,
        receiverName: req.user.name,
      };
      selectedCommitmentValue = 0;
    }

    const { commitments, txReceipt } = await zkp.simpleFTCommitmentBatchTransfer(
      { address },
      req.body,
    );
    if (changeIndex) changeData = commitments.splice(changeIndex, 19);
    // update slected coin1 with tansferred data
    await db.updateFTCommitmentByCommitmentHash(req.user, req.body.commitment, {
      amount,
      salt,
      commitment,
      commitmentIndex,
      batchTransfer: commitments,
      changeAmount: changeData[0].value,
      changeSalt: changeData[0].salt,
      changeCommitment: changeData[0].commitment,
      changeCommitmentIndex: changeData[0].commitmentIndex,
      isBatchTransferred: true,
    });

    // add change to user database
    if (changeIndex) {
      await db.insertFTCommitment(req.user, {
        amount: changeData[0].value,
        salt: changeData[0].salt,
        commitment: changeData[0].commitment,
        commitmentIndex: changeData[0].commitmentIndex,
        isChange: true,
      });
    }

    for (const data of commitments) {
      /* eslint-disable no-continue */
      if (!Number(data.value)) continue;
      await whisperTransaction(req, {
        amount: data.value,
        salt: data.salt,
        publicKey: data.receiverPublicKey,
        commitment: data.commitment,
        commitmentIndex: data.commitmentIndex,
        blockNumber: txReceipt.receipt.blockNumber,
        receiver: data.receiverName,
        for: 'FTCommitment',
      });
    }

    res.data = commitments;
    next();
  } catch (err) {
    next(err);
  }
}
