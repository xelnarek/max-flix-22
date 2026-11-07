import assert from 'node:assert/strict';
import test from 'node:test';
import { PvpLocalBotSession } from '../src/pvpClient.ts';

test('PvpLocalBotSession initializes room, countdown, and delivers authoritative updates', async () => {
  let createdCode = '';
  let slotAssigned = '';
  let updateCount = 0;

  const session = new PvpLocalBotSession('marcin', 'grzesiek', 'Tester', {
    onRoomCreated: (code, slot) => {
      createdCode = code;
      slotAssigned = slot;
    },
    onStateUpdate: () => {
      updateCount++;
    },
  });

  assert.equal(session.isLocalBot, true);
  assert.equal(session.slot, 'p1');

  // Wait 120ms for loop ticks
  await new Promise((resolve) => setTimeout(resolve, 120));

  assert.equal(createdCode, 'BOT-1V1');
  assert.equal(slotAssigned, 'p1');
  assert.ok(updateCount > 0);

  // Send move and aim input
  session.sendInput({
    moveX: 1,
    moveZ: 0,
    aimAngle: Math.PI / 2,
    isFiring: false,
  });

  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.ok(updateCount >= 2);

  session.dispose();
});
