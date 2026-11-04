// Dry Heat dialogue lines. Plain data, no imports. Content: MiniMax. Lookup: Codex (game.line(key)).
//
// Short spoken lines, logged as  Name: "line".  Code asks for a key; the lookup picks one variant at
// random from those whose `needs` hold, and says nothing if none do. Voices: docs/STORY.md section 3
// (Marcus deflects with jokes and lists, Elena is direct and tired, Jess is dry and fifteen, Theo is
// seven). Walt: docs/STORY.md section 0. Write him with dignity: an expert losing something, never a joke.
// Lines are one sentence, two at most. No narration, no stage directions, never the word "shift".
//
// Schema
//   key: 'speaker.situation'  -> array of variants (4 to 6 each)
//   variant: a string, or { text, needs } where needs is { flag: { name: value } } on game flags.
//   Flags available: gas ('full'|'quarter'), jugs ('shelf'|'recycled'), cart ('water'|'pharmacy'|'birthday'),
//   walt ('walked'|'wavedOff'). cart names what was PUT BACK at the register ('pharmacy' = no spare inhaler, no BP refill).
//
// Keys the code calls (write all of them):
//   marcus.solar.dead        day 1, finding the solar panels do nothing ("We have solar, why is nothing on?")
//   elena.solar.lease        her answer, the $140 a month lease
//   marcus.car.ac            running the car to cool someone down
//   elena.car.fuel           worrying about the gas left (variants for gas full / quarter)
//   marcus.jugs.remember     the jugs paying off, or missing (variants for shelf / recycled)
//   elena.shade.window       putting foil or the windshield shade on a west window
//   jess.tarp                rigging the tarp shade in the yard
//   marcus.grill             cooking on the grill at night
//   walt.greet.lucid         Walt on a clear morning
//   walt.greet.confused      Walt on a bad day (wrong name, looks for his wife, asks what year it is)
//   walt.greet.stranger      first visit when he doesn't trust them yet (needs walt: 'wavedOff')
//   walt.instruct.right      a correct, specific wiring instruction (charge controller, battery, breaker)
//   walt.instruct.wrong      a confident instruction that is wrong and dangerous (the player must catch it)
//   walt.memory              his trade, his wife, a job he's proud of
//   walt.daughter            his daughter in Tucson
//   walt.water.thanks        when the family brings him water
//   walt.circuit.done        the circuit works
//   jess.walt                Jess about Walt, or to him
//   theo.nebulizer           Theo on the nebulizer, or the fan running
//   marcus.shock             Marcus after a wrong connection hurts him
//
// More keys are welcome later (lines for decisions, trust, Jess); unknown keys are simply never called.

export const LINES = {
  'marcus.solar.dead': [
    'We have solar. Why is nothing on?',
    'Those panels cost a hundred and forty dollars a month. They are sitting on the roof doing nothing.',
    'The lease says the inverter shuts itself down when the grid goes down. So the panels are dead.',
    'Okay, so the roof is useless. Tell me what we do with the roof.',
    'Nothing on the meter, nothing on the inverter, nothing on the hot water. That is a lot of money for nothing.',
    'Elena, come look at this. The panels are not doing a thing.',
  ],
  'walt.greet.lucid': [
    'You\'re the one with the little fella. Marcus. Come in out of that sun.',
    'Good morning. I have been up since four because the house was already hot, and that is the best hour of the day in July.',
    'I walked over at five and looked at your meter, and nothing is coming in. I wanted to see it with my own eyes before I said a word.',
    'Your string is doing what it is supposed to do. The utility side is the part that is dead.',
    'Everybody wants to know about the panels. Sit down before the sun finds you.',
    'Good, you are drinking water. Nobody in this town drinks enough water.',
  ],
  'elena.solar.lease': [
    'The lease says we pay them every month for panels that make electricity when the electricity is already on.',
    'One hundred and forty a month. I signed it because the salesman had a chart with an arrow going up.',
    'They told us the inverter would island. I did not know what that meant either.',
    'We are still paying for it. That is the part that makes me angry.',
    'Read the contract, there is a clause about grid outages, and somebody thought about this and still took our money.',
    'He said it would pay for itself in nine years. It paid for itself right up until the sky came apart.',
  ],
  'marcus.car.ac': [
    'Get in the back. Windows up, doors locked, radio off so we can hear him.',
    'Ten minutes, then we are out of the car and back in the shade.',
    'The car still has air conditioning. I am not going to pretend that is nothing.',
    'I am keeping the engine running and the doors shut. It burns gas, but he is seven.',
    'Everybody out, now. The tank does not care how hot it is outside.',
    'That is most of a gallon of gas for an hour of cold. Do not waste it.',
  ],
  'elena.car.fuel': [
    { text: 'The gauge is full. I filled it Friday, and it is the best money we have spent in years.', needs: { flag: { gas: 'full' } } },
    { text: 'We have a full tank. Do not spend it on a drive that does not have to happen.', needs: { flag: { gas: 'full' } } },
    { text: 'A quarter of a tank. I told you we should have filled it Friday.', needs: { flag: { gas: 'quarter' } } },
    { text: 'The gauge says a quarter, and there is not a working pump between here and the coast.', needs: { flag: { gas: 'quarter' } } },
    'Check the gauge before you turn the key. Every time we start it, that is a little less of everything.',
    'Whatever is in the tank is all the cooling we are going to get. Do not ask me for more than that.',
  ],
  'marcus.jugs.remember': [
    { text: 'Those fourteen jugs on the shelf. Forty liters, if we are careful with it.', needs: { flag: { jugs: 'shelf' } } },
    { text: 'Get the jugs down off the shelf. Every one of them is a day somebody does not ask for water.', needs: { flag: { jugs: 'shelf' } } },
    { text: 'We recycled the jugs, I know. I will find us something to carry water in.', needs: { flag: { jugs: 'recycled' } } },
    { text: 'If we had kept those jugs we would be sitting on forty liters right now. I know.', needs: { flag: { jugs: 'recycled' } } },
    'Do we still have those jugs? Where did we put the jugs?',
    'Water is going to be the whole game now. Everything else is a rounding error.',
  ],
  'elena.shade.window': [
    'Get the foil out of the kitchen drawer. The west window is the one that cooks us.',
    'This is not going to help much. It is going to help a little.',
    'Foil on the glass, not on the frame. Tape the corners, the heat lifts the edges.',
    'You can hold the curtain with a chair. It works as well as foil and it costs nothing.',
    'Move the table off that wall. The wall is the hot one.',
    'When the sun comes off that window we can open it. Until then it stays shut.',
  ],
  'jess.tarp': [
    'Two poles and the tarp. If the wind picks up, it will come down on whoever is eating.',
    'It is going to sag in the middle. I need one more pole and I am not digging for it at noon.',
    'The whole street could use one of these. Nobody is going to put one up.',
    'I will do it at six, when it is cooler. Do not ask me at noon.',
    'Fine. But if it comes down while we are eating, I am not the one who set it up.',
    'There is a longer pole in the garage, behind the Christmas stuff.',
  ],
  'marcus.grill': [
    'Grill on the porch. Not on the grass, and not with the lid shut.',
    'We have one bag of charcoal. That is the whole cook.',
    'Meat tastes better when it is dark out. That is the only good news today.',
    'The charcoal smoke is not going to be good for Theo. Open the slider before I light it.',
    'Let them smell this from three doors down, we have not had a cook in a week.',
    'Do not put the lighter near the foil on the window. I am serious.',
  ],
  'walt.greet.confused': [
    'Walter Dezavant. The last name you said is mine, so I must be the one you want.',
    'Is it ninety-eight? I know it is not, and I cannot get the year to hold still.',
    'My Margaret would know what to do with this. She always knew what to do with this.',
    'You are a neighbor. I know all six of them, and yours is not one I know yet.',
    'What year is it? Do not tell me, no, tell me, I want to know.',
    'She passed five years ago, or six. I am not going to argue with myself about it.',
  ],
  'walt.greet.stranger': [
    { text: 'I know your face. I do not know your name, and I am not going to guess it in this heat.', needs: { flag: { walt: 'wavedOff' } } },
    { text: 'The man across the street told me I was fine and went inside. I have been thinking about that all week.', needs: { flag: { walt: 'wavedOff' } } },
    { text: 'You are the family with the panels. I have not met you and I have not needed anything, and if you do need something, you will find me out front in the morning.', needs: { flag: { walt: 'wavedOff' } } },
    'Walt. Walter Dezavant, if you are writing it down, thirty-one years on this street.',
    'If you are here about the power, come early. After ten I am not much company.',
    'Nobody comes over here without wanting something. Go ahead, I have time.',
  ],
  'walt.instruct.right': [
    'Positive from the first box to the charge controller, negative to negative, and check the polarity twice before you close anything. Reverse the polarity and you will cook the controller.',
    'Breaker in the box first, between the panels and the controller. Then the battery: positive first, controller to the breaker, panels last.',
    'A deep-cycle battery, not the one out of the Camry. A starting battery will boil in a week.',
    'Read me the gauge: twelve point six volts or better, it will take a charge, and below that it will not hold anything.',
    'Controller, breaker, battery, and the panels last. Leave that breaker off until everything is landed and you have checked the polarity twice.',
    'I have a fuse the right size in the truck. Bring it, and do not use a piece of wire.',
  ],
  'walt.instruct.wrong': [
    'Skip the breaker, it is only a little juice and it will trip the first time the sun hits it. Wire the panels straight into the controller and we will have a fan by lunch.',
    'Take the feed from the line side of the meter. That is where the power is thickest, and it will push everything through that controller in one good push.',
    'Positive to the negative, negative to the positive, that is how you get the most out of them. Do not fuss with the labels, they are put on by hand.',
    'Do not bother with a controller, the panels know what to do. Hook them straight to the battery and let the battery work it out.',
    'Skip the fuse as well, fuses are for people who are not sure of themselves. If it gets warm, that is the controller doing its job.',
  ],
  'walt.memory': [
    'I pulled wire for forty-one years, commercial work, hospitals mostly, because a hospital does not get to make a mistake.',
    'Master electrician, and I did not buy the certificate. Twenty-two years downtown and I still know what feeds what.',
    'Margaret and I bought this house in 1995 and put the panels on in 2009. She wanted the quiet, with the birds in the yard, and I gave her the quiet.',
    'I wired the church on 19th Avenue back when it was a schoolhouse. It is still there and it still passes.',
    'People ask if I am scared, and I am not. It is the one thing that still does what it tells me.',
    'They tore out the substation behind the plant where I trained. There is not another one like it left.',
  ],
  'walt.daughter': [
    'My daughter is in Tucson, she is a nurse, and I have been telling her about the heat since she was nine.',
    'Loretta. It is Loretta with an R.',
    'She calls on Tuesdays. She is going to keep calling on Tuesdays.',
    'She wanted me to move in with her in 2011 and I said I would think about it. I have been thinking about it six years.',
    'She is trying to find a way out here and I told her not to. The roads are not there.',
    'If she comes and you are the one here, tell her I am all right. I am all right.',
  ],
  'walt.water.thanks': [
    'Thank you. You did not have to do that, and I am going to remember that you did.',
    'Put it on the counter where I can see it. My eyes are not what they were.',
    'Four gallons, that is more than I have had in a week. Thank you.',
    'Do not look for your money back. There is no money, and there is not going to be for a while.',
    'Come back at seven, before it gets hot. Bring your father.',
    'Water is the last thing anybody thinks about until there is none of it. You thought about it.',
  ],
  'walt.circuit.done': [
    'There it is, twelve volts and holding. That is a circuit.',
    'The controller is charging and the fan is turning. Do not shut it off, or the battery sulks.',
    'You did it. I want you to understand that you did it and I only talked.',
    'Now that is what a hundred and forty dollars a month is supposed to look like.',
    'The sun charges it in the morning, it runs the fan until dark, and then the battery sleeps.',
    'That gauge will read thirteen point eight by four o\'clock and twelve point six after the sun is off it. That is how you know it is working.',
  ],
  'jess.walt': [
    'He does not know my name. I have told him four times and he writes it on his hand.',
    'He explained the meter to me for twenty minutes. Nobody explains anything to me for twenty minutes.',
    'He asked me what year it is and I told him, and he wrote it down. It is on his hand now.',
    'My grandpa says there were only three master electricians in this county. Walt was one of them.',
    'He gives me the cold water. He says it is because I am the only one who knocks.',
    'I check on him before the heat. If you need me, I am out back.',
  ],
  'theo.nebulizer': [
    'Is the machine going to run all night? Can it run all night?',
    'It is cold in here. I like the machine.',
    'My chest does the tight thing when it is hot. Can I have the machine?',
    'I can hear the fan. It sounds a little bit like the car.',
    'Mommy\'s inhaler is almost empty. The one in the car is mine, right?',
    'Can I hold it? I can hold it, I do it at the doctor.',
  ],
  'marcus.shock': [
    'I am fine. Do not come out here.',
    'That was the line side, I had the meter open. I know exactly what I did.',
    'My arm is numb from the wrist down. Do not touch the wire.',
    'Elena, the breaker in the garage, get it off. Now.',
    'He told me to do it and I did it. That is the whole of it.',
    'I am not going back up on that roof today.',
  ],
};
