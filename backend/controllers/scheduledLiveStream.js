const ScheduledLiveStream = require('../models/ScheduledLiveStream');

exports.scheduleStream = async (req, res) => {
  try {
    const { userId, title, description, scheduledAt } = req.body;
    const stream = await ScheduledLiveStream.create({ userId, title, description, scheduledAt });
    res.status(201).json(stream);
  } catch (error) {
    res.status(500).json({ msg: 'Planifikimi i stream-it dështoi' });
  }
};

exports.getScheduledStreams = async (req, res) => {
  try {
    const streams = await ScheduledLiveStream.findAll({
      where: { status: 'scheduled' },
      order: [['scheduledAt', 'ASC']],
    });
    res.status(200).json(streams);
  } catch (error) {
    res.status(500).json({ msg: 'Ngarkimi i stream-eve të planifikuara dështoi' });
  }
};

exports.updateStreamStatus = async (req, res) => {
  try {
    const { streamId } = req.params;
    const { status } = req.body;
    const stream = await ScheduledLiveStream.findByPk(streamId);
    if (!stream) return res.status(404).json({ msg: 'Stream-i nuk u gjet' });
    stream.status = status;
    await stream.save();
    res.status(200).json(stream);
  } catch (error) {
    res.status(500).json({ msg: 'Përditësimi i statusit të stream-it dështoi' });
  }
};
