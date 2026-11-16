            if (_pendingBossReward)
            {
                _pendingBossReward = false;
                BeginLevelUp(true);
                return;
            }