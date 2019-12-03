import express from "express";
import { Msg, User } from '../../db/models';
import NodeRSA from 'node-rsa';
import { sha512 } from 'js-sha512';

const msg = express.Router();

msg.post('/send', send);
msg.get('/list/:to', getList);

// 메시지 전송
async function send(req, res) {
  try {
    const { from, to, content } = req.body;
    const userInfo = await User.findOne({ hash: from });
    // 발신자 기준으로 유저 이름, 유저 개인키 획득
    const { name: sender_name, privatekey } = userInfo;
    // 메시지 내용 해시화 
    const msgHash = sha512(content);
    // 개인키로 메시지 서명
    const key = new NodeRSA(privatekey);
    const sign = key.sign(msgHash, 'base64');
    // 메시지 정보를 데이터베이스에 저장
    const msg = new Msg({ from, to, content, sign, sender_name });
    const data = await msg.save();
    // 저장된 데이터를 요청자에게 반환
    res.status(200).send(data);
  } catch (e) {
    console.error(e);
    res.status(500).send(e);
  }
}

// 메시지 리스트
// 수신자 계정 정보(to)를 기준으로 메시지 리스트 반환
async function getList(req, res) {
  const { to } = req.params;

  try {
    // pr_keyring 테이블과 msg.from = user_hash 로 조인을 한 결과 반환
    const data = await Msg.aggregate([
      {
        $lookup: {
          from: 'pr_keyring',
          localField: 'from',
          foreignField: 'user_hash',
          as: 'pr_keyring', // join 시 컬럼명
        },
      },
      {
        $match: { to }, // where 절
      },
    ]);
    res.status(200).send(data);
  } catch (e) {
    console.error(e);
    res.status(500).send(e);
  }
}

export default msg;