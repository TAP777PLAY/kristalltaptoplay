(function (global) {
  const KEY = "gem-brawl-save-v1";
  const defaults = {
    name: "Игрок",
    unlocked: 1,
    stars: {},
    best: {},
    trophies: 0,
    coins: 0,
    sfx: true,
    music: true,
    musicIndex: 0,
    scores: [],
    clears: 0,
    vkId: 0,
    photo: "",
    nameCustom: false,
    boosters: { hammer: 3, shuffle: 1 },
  };

  function load() {
    try {
      const data = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
      if (!data.boosters) data.boosters = { ...defaults.boosters };
      else data.boosters = { ...defaults.boosters, ...data.boosters };
      if (!data.nameCustom && data.name === "Боец") data.name = "Игрок";
      return data;
    } catch (e) {
      return { ...defaults, boosters: { ...defaults.boosters } };
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function addScore(data, entry) {
    data.scores = [entry, ...(data.scores || [])].slice(0, 30);
    data.scores.sort((a, b) => b.trophies - a.trophies || b.score - a.score);
  }

  global.Save = { load, save, addScore, defaults };
})(window);
