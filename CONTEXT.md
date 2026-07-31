# Regicide Game

The domain language for a cooperative Regicide game, covering the cards, combat, player choices,
and outcomes defined by the official rules.

## Language

**Card**:
A unique physical game card that retains its identity as it moves between the Castle, hands, the Tavern, play, and discard.
_Avoid_: Card Copy, Card Instance

**Royal Card**:
A Jack, Queen, or King card that begins in the Castle and may later join the players after an exact defeat.
_Avoid_: Enemy Card, Court Card

**Current Enemy**:
The Royal Card currently fighting the players, together with the damage and defensive effects accumulated during that fight.
_Avoid_: Enemy Card, Boss

**Animal Companion**:
A value-one card that may fight alone or pair with exactly one other non-Jester card.
_Avoid_: Ace

**Jester**:
A value-zero card that cancels the Current Enemy's immunity and lets its player choose who acts next.
_Avoid_: Joker

**Play**:
An accepted choice that places one legal card or card group against the Current Enemy.
_Avoid_: Move, Attack

**Yield**:
A choice to play no cards and proceed directly to suffering damage from the Current Enemy.
_Avoid_: Pass, Skip

**Hearts**:
The suit whose ability returns cards from the discard pile to the Tavern.
_Avoid_: Heart

**Diamonds**:
The suit whose ability draws cards from the Tavern into player hands.
_Avoid_: Diamond

**Clubs**:
The suit whose ability doubles Damage dealt to the Current Enemy.
_Avoid_: Club

**Spades**:
The suit whose ability shields players from the Current Enemy's attack.
_Avoid_: Spade

**Card Value**:
The base numeric value of one card when it is played or discarded to satisfy damage.
_Avoid_: Power, Strength

**Attack Value**:
The sum of Card Values in one Play before suit effects modify its outcome.
_Avoid_: Power, Damage

**Damage**:
The amount actually applied to the Current Enemy after the Play's Clubs effect is resolved.
_Avoid_: Attack Value, Enemy Attack

**Enemy Attack**:
The Current Enemy's base counterattack value before effective Spades Shield is subtracted.
_Avoid_: Damage, Power

**Game Outcome**:
The final victory or loss, including the solo victory rating or the rule and player responsible for a loss.
_Avoid_: Status, Result Message
