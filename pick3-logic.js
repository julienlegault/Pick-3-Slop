(function(global) {
  var CX = 210, CY = 210, R = 175;
  var LAND = 90;
  var RARITY_SCALE = {
    common:    [1.0, 0.9, 0.8, 0.6, 0.4],
    uncommon:  [0.05, 0.22, 0.55, 1.1, 1.6],
    rare:      [0.001, 0.05, 0.32, 1.0, 2.2],
    legendary: [0.0002, 0.01, 0.12, 0.55, 1.6],
  };

  function rarityMult(rarity, gl) {
    var arr = RARITY_SCALE[rarity] || [1];
    return arr[Math.min(gl, arr.length - 1)];
  }

  var BOONS = [
    { id:'w1', name:'Fortune Sliver',     rarity:'common',    w:30, desc:'Replace a lose tile with a win tile.',                                                  effect:'add_win',     amount:1 },
    { id:'ls', name:'Diminished Doom',    rarity:'uncommon',  w:6,  desc:'Lose tiles are 30% smaller. Stacks multiplicatively.',                                  effect:'lose_shrink', mult:0.7 },
    { id:'tw', name:'Phantom Tile',       rarity:'uncommon',  w:6,  desc:'Each spin: +1 temporary win tile (does not count toward wheel growth).',                effect:'temp_win',    amount:1 },
    { id:'wg', name:'Gilded Fortune',     rarity:'uncommon',  w:6,  desc:'Win tiles are 30% larger. Stacks multiplicatively.',                                    effect:'win_grow',    mult:1.3 },
    { id:'lb', name:'Lucky Break',        rarity:'uncommon',  w:5,  desc:'On a loss: 25% chance to win. Copies add +25% additively, capped at 80%.',              effect:'rescue_add',  chance:0.25 },
    { id:'w2', name:'Twin Slivers',       rarity:'uncommon',  w:5,  desc:'Replace 2 lose tiles with win tiles.',                                                  effect:'add_win',     amount:2 },
    { id:'ga', name:'Guardian Angel',     rarity:'rare',      w:3,  desc:'Next loss becomes a win. One-time use. Each copy is an independent charge.',            effect:'shield',      charges:1 },
    { id:'wf', name:'Weighted Fate',      rarity:'rare',      w:3,  desc:'On a loss: 40% chance to win instead. Each copy triggers independently.',               effect:'rescue_mul',  chance:0.40 },
    { id:'sc', name:'Spoiled for Choice', rarity:'rare',      w:2,  desc:'+1 boon choice per shop visit. Stacks.',                                                effect:'extra_choice' },
    { id:'ft', name:'Fortunes Tide',      rarity:'legendary', w:1,  desc:'Win tiles 60% larger AND lose tiles 60% smaller. Stacks multiplicatively.',             effect:'tide' },
    { id:'ec', name:'Echo Chamber',       rarity:'legendary', w:1,  desc:'Immediately duplicate a random boon in your collection.',                               effect:'duplicate' },
    { id:'gf', name:'Gale Fortune',       rarity:'legendary', w:1,  desc:'Immediately replace 5 lose tiles with win tiles.',                                      effect:'add_win',     amount:5 },
  ];
  var TOTAL_W = BOONS.reduce(function(s, b) { return s + b.w; }, 0);
  var RC = { common:'#909090', uncommon:'#4a9eff', rare:'#c060ff', legendary:'#D4AF37' };
  var INIT_TILES = [
    { id:0, type:'win'  }, { id:1, type:'lose' },
    { id:2, type:'win'  }, { id:3, type:'lose' },
    { id:4, type:'win'  }, { id:5, type:'lose' },
  ];

  function polar(deg, r) {
    var rr = r === undefined ? R : r;
    var rad = (deg - 90) * Math.PI / 180;
    return { x: CX + rr * Math.cos(rad), y: CY + rr * Math.sin(rad) };
  }
  function slicePath(a1, a2) {
    if (a2 - a1 >= 359.99) {
      var p = polar(a1);
      return 'M ' + CX + ',' + CY + ' L ' + p.x + ',' + p.y + ' A ' + R + ',' + R + ' 0 1 1 ' + (p.x - 0.01) + ',' + p.y + ' Z';
    }
    var s = polar(a1), e = polar(a2);
    var lg = a2 - a1 > 180 ? 1 : 0;
    return 'M ' + CX + ',' + CY + ' L ' + s.x + ',' + s.y + ' A ' + R + ',' + R + ' 0 ' + lg + ' 1 ' + e.x + ',' + e.y + ' Z';
  }
  function revealWedge(halfSpan) {
    var hs = Math.max(12, Math.min(65, halfSpan));
    var ox = 0, oy = 130, rr = 265;
    function p(d) {
      var rad = (d - 90) * Math.PI / 180;
      return { x: ox + rr * Math.cos(rad), y: oy + rr * Math.sin(rad) };
    }
    var s = p(90 - hs), e = p(90 + hs);
    return 'M ' + ox + ',' + oy + ' L ' + s.x + ',' + s.y + ' A ' + rr + ',' + rr + ' 0 0 1 ' + e.x + ',' + e.y + ' Z';
  }

  function buildLayout(tiles, boons, addTemp) {
    var wm = 1, lm = 1, tmp = 0;
    for (var i = 0; i < boons.length; i++) {
      var b = boons[i];
      if (b.effect === 'win_grow') wm *= b.mult;
      if (b.effect === 'lose_shrink') lm *= b.mult;
      if (b.effect === 'tide') { wm *= 1.6; lm *= 0.4; }
      if (b.effect === 'temp_win' && addTemp) tmp += b.amount;
    }
    var result = tiles.map(function(t) { return Object.assign({}, t, { sz: t.type === 'win' ? wm : lm }); });
    for (var j = 0; j < tmp; j++) result.push({ id: '_t' + j, type: 'win', sz: wm, temp: true });
    return result;
  }
  function calcAngles(layout) {
    var total = layout.reduce(function(s, t) { return s + t.sz; }, 0);
    var cum = 0;
    return layout.map(function(t) {
      var span = (t.sz / total) * 360;
      var start = cum; cum += span;
      return { start: start, end: cum, center: start + span / 2 };
    });
  }
  function pickWeighted(layout) {
    var tot = layout.reduce(function(s, t) { return s + t.sz; }, 0);
    var r = Math.random() * tot;
    for (var i = 0; i < layout.length; i++) {
      r -= layout[i].sz;
      if (r <= 0) return i;
    }
    return layout.length - 1;
  }
  function drawBoons(count, gl) {
    var scaledW = BOONS.map(function(b) { return b.w * rarityMult(b.rarity, gl); });
    var total = scaledW.reduce(function(s, w) { return s + w; }, 0);
    var out = [], used = {};
    for (var tries = 0; tries < 600 && out.length < count; tries++) {
      var r = Math.random() * total;
      for (var i = 0; i < BOONS.length; i++) {
        r -= scaledW[i];
        if (r <= 0) {
          if (!used[i]) {
            used[i] = true;
            out.push(Object.assign({}, BOONS[i], { iid: BOONS[i].id + '_' + Date.now() + '_' + out.length }));
          }
          break;
        }
      }
    }
    return out;
  }
  function tryRescue(boons) {
    var nb = boons.map(function(b) { return Object.assign({}, b); });
    for (var i = 0; i < nb.length; i++) {
      if (nb[i].effect === 'shield' && nb[i].charges > 0) {
        nb[i] = Object.assign({}, nb[i], { charges: nb[i].charges - 1 });
        return { ok: true, boons: nb };
      }
    }
    var addP = 0;
    nb.forEach(function(b) { if (b.effect === 'rescue_add') addP += b.chance; });
    if (addP > 0 && Math.random() < Math.min(addP, 0.8)) return { ok: true, boons: nb };
    for (var j = 0; j < nb.length; j++) {
      if (nb[j].effect === 'rescue_mul' && Math.random() < nb[j].chance) return { ok: true, boons: nb };
    }
    return { ok: false, boons: nb };
  }
  function applyBoon(boon, tiles, boons, nid) {
    var t2 = tiles.slice();
    var b2 = boons.concat([Object.assign({}, boon)]);
    var id = nid;
    if (boon.effect === 'add_win') {
      for (var i = 0; i < boon.amount; i++) {
        var li = -1;
        for (var k = 0; k < t2.length; k++) {
          if (t2[k].type === 'lose') { li = k; break; }
        }
        if (li !== -1) t2[li] = { id: t2[li].id, type: 'win' };
        else t2.push({ id: id++, type: 'win' });
      }
    }
    if (boon.effect === 'duplicate' && boons.length > 0) {
      var src = boons[Math.floor(Math.random() * boons.length)];
      b2.push(Object.assign({}, src, { iid: 'dup_' + Date.now() }));
    }
    var grew = t2.every(function(t) { return t.type === 'win'; });
    if (grew) {
      var n = t2.length;
      t2 = [];
      for (var j = 0; j < n * 3; j++) t2.push({ id: id++, type: j % 3 === 0 ? 'win' : 'lose' });
    }
    return { tiles: t2, boons: b2, nextId: id, grew: grew };
  }

  global.Pick3Logic = {
    CX: CX,
    CY: CY,
    R: R,
    LAND: LAND,
    RARITY_SCALE: RARITY_SCALE,
    BOONS: BOONS,
    TOTAL_W: TOTAL_W,
    RC: RC,
    INIT_TILES: INIT_TILES,
    rarityMult: rarityMult,
    polar: polar,
    slicePath: slicePath,
    revealWedge: revealWedge,
    buildLayout: buildLayout,
    calcAngles: calcAngles,
    pickWeighted: pickWeighted,
    drawBoons: drawBoons,
    tryRescue: tryRescue,
    applyBoon: applyBoon,
  };
})(window);
