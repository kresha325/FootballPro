const VideoCall = require('../models/VideoCall');
const ScheduledCall = require('../models/ScheduledCall');
const User = require('../models/User');
const { sendNotification } = require('./notifications');
const { Op } = require('sequelize');

// Create a video call
exports.createVideoCall = async (req, res) => {
  try {
    const { participantId, scheduledCallId } = req.body;

    const videoCall = await VideoCall.create({
      callerId: req.user.id,
      receiverId: participantId,
      scheduledCallId,
      status: 'ringing',
      startTime: new Date(),
    });

    // Notify participant
    await sendNotification(
      participantId, 
      'Incoming Call', 
      `${req.user.firstName} ${req.user.lastName} is calling you`, 
      { type: 'call', callId: videoCall.id }
    );

    res.json(videoCall);
  } catch (error) {
    console.error('Create video call error:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
};

exports.startCall = async (req, res) => {
  const { receiverId } = req.body;
  try {
    const call = await VideoCall.create({
      callerId: req.user.id,
      receiverId,
      status: 'ringing',
      startTime: new Date(),
    });
    // Notify receiver
    await sendNotification(receiverId, 'Incoming Call', `You have an incoming call from ${req.user.firstName}`, { type: 'call', callId: call.id });
    res.json(call);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.endCall = async (req, res) => {
  const { callId } = req.params;
  try {
    const call = await VideoCall.findByPk(callId);
    if (call) {
      call.status = 'ended';
      call.endTime = new Date();
      call.duration = Math.floor((new Date() - call.startTime) / 1000);
      await call.save();
    }
    res.json({ msg: 'Call ended', call });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get active call
exports.getActiveCall = async (req, res) => {
  try {
    const activeCall = await VideoCall.findOne({
      where: {
        [Op.or]: [
          { callerId: req.user.id },
          { receiverId: req.user.id },
        ],
        status: { [Op.in]: ['ringing', 'connected'] },
      },
      include: [
        { model: User, as: 'caller', attributes: ['id', 'firstName', 'lastName'] },
        { model: User, as: 'receiver', attributes: ['id', 'firstName', 'lastName'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json(activeCall);
  } catch (error) {
    console.error('Get active call error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Update call status
exports.updateCallStatus = async (req, res) => {
  try {
    const { callId } = req.params;
    const { status } = req.body;

    const videoCall = await VideoCall.findByPk(callId);
    if (!videoCall) {
      return res.status(404).json({ msg: 'Call not found' });
    }

    videoCall.status = status;
    if (status === 'ended' || status === 'declined') {
      videoCall.endTime = new Date();
      videoCall.duration = Math.floor((new Date() - videoCall.startTime) / 1000);
    }

    await videoCall.save();
    res.json(videoCall);
  } catch (error) {
    console.error('Update call status error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get call history
exports.getCallHistory = async (req, res) => {
  try {
    const calls = await VideoCall.findAll({
      where: {
        [Op.or]: [
          { callerId: req.user.id },
          { receiverId: req.user.id },
        ],
      },
      include: [
        { model: User, as: 'caller', attributes: ['id', 'firstName', 'lastName'] },
        { model: User, as: 'receiver', attributes: ['id', 'firstName', 'lastName'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 50,
    });

    res.json(calls);
  } catch (error) {
    console.error('Get call history error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.scheduleCall = async (req, res) => {
  const { receiverId, scheduledTime } = req.body;
  try {
    const scheduledCall = await ScheduledCall.create({
      callerId: req.user.id,
      receiverId,
      scheduledTime,
    });
    // Notify receiver
    await sendNotification(receiverId, 'Scheduled Call', `You have a scheduled call with ${req.user.firstName} at ${scheduledTime}`, { type: 'scheduled_call', callId: scheduledCall.id });
    res.json(scheduledCall);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getScheduledCalls = async (req, res) => {
  try {
    const calls = await ScheduledCall.findAll({
      where: {
        [require('sequelize').Op.or]: [
          { callerId: req.user.id },
          { receiverId: req.user.id },
        ],
      },
      include: [
        { model: require('../models/User'), as: 'caller', attributes: ['id', 'firstName', 'lastName'] },
        { model: require('../models/User'), as: 'receiver', attributes: ['id', 'firstName', 'lastName'] },
      ],
      order: [['scheduledTime', 'ASC']],
    });
    res.json(calls);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};