import { describe, expect, it } from "vitest";

import { parse } from "../src/html.js";
import { runRules } from "../src/rules.js";

function findingsFor(html: string, only?: string[]) {
  return runRules(parse(html), only);
}

/** Restricts to one rule, so a fragment missing unrelated page-level
 * things (a <title>, an <html lang>) does not pollute a test that is
 * only about the rule named here. */
function only(rule: string, html: string) {
  return findingsFor(html, [rule]);
}

const CLEAN = `<!DOCTYPE html>
<html lang="en">
<head><title>A real page title</title></head>
<body>
  <img src="cat.png" alt="A cat sleeping on a windowsill">
  <a href="/about">About this project</a>
  <label for="email-field">Email</label>
  <input type="email" id="email-field">
  <h1>Welcome</h1>
  <h2>Section</h2>
  <table>
    <tr><th>Name</th><th>Age</th></tr>
    <tr><td>Alice</td><td>30</td></tr>
  </table>
  <iframe src="x" title="Embedded video"></iframe>
  <button onclick="doThing()">Do the thing</button>
</body>
</html>`;

describe("a well-formed page", () => {
  it("produces no findings at all", () => {
    expect(findingsFor(CLEAN)).toEqual([]);
  });
});

describe("missing-alt", () => {
  it("fires on an img with no alt attribute", () => {
    const findings = only("missing-alt", '<img src="a.png">');
    expect(findings.map((f) => f.rule)).toEqual(["missing-alt"]);
    expect(findings[0]!.severity).toBe("error");
    expect(findings[0]!.affected).toMatch(/screen reader/);
  });

  it("does not fire inside an aria-hidden or hidden ancestor (whole subtree is removed)", () => {
    expect(only("missing-alt", '<div aria-hidden="true"><p><img src="a.png"></p></div>')).toEqual([]);
    expect(only("missing-alt", '<section hidden><img src="b.png"></section>')).toEqual([]);
    expect(only("missing-alt", '<div aria-hidden="false"><img src="c.png"></div>')).toHaveLength(1);
  });

  it("does not fire when alt is present, even if empty (decorative)", () => {
    expect(only("missing-alt", '<img src="a.png" alt="">')).toEqual([]);
  });
});

describe("unlabelled-form-control", () => {
  const RULE = "unlabelled-form-control";

  it("fires on an input with no label of any kind", () => {
    const findings = only(RULE, '<input type="text" id="x">');
    expect(findings.map((f) => f.rule)).toEqual([RULE]);
  });

  it("is satisfied by a matching label[for]", () => {
    const html = '<label for="x">Name</label><input type="text" id="x">';
    expect(only(RULE, html)).toEqual([]);
  });

  it("is satisfied by a wrapping label", () => {
    const html = '<label>Name <input type="text"></label>';
    expect(only(RULE, html)).toEqual([]);
  });

  it("is satisfied by aria-label", () => {
    expect(only(RULE, '<input type="text" aria-label="Name">')).toEqual([]);
  });

  it("is satisfied by aria-labelledby", () => {
    const html = '<span id="lbl">Name</span><input type="text" aria-labelledby="lbl">';
    expect(only(RULE, html)).toEqual([]);
  });

  it("does not flag hidden, submit, button or image type inputs", () => {
    const html =
      '<input type="hidden"><input type="submit"><input type="button"><input type="image">';
    expect(only(RULE, html)).toEqual([]);
  });

  it("fires for select and textarea too", () => {
    const findings = only(RULE, "<select></select><textarea></textarea>");
    expect(findings.map((f) => f.tag)).toEqual(["select", "textarea"]);
  });
});

describe("link-text", () => {
  const RULE = "link-text";

  it("fires empty-link on an anchor with no text at all", () => {
    const findings = only(RULE, '<a href="/x"></a>');
    expect(findings.map((f) => f.rule)).toEqual(["empty-link"]);
  });

  it("is satisfied by an aria-label on an otherwise empty link", () => {
    expect(only(RULE, '<a href="/x" aria-label="Go to profile"></a>')).toEqual([]);
  });

  it("is satisfied by an image with alt text inside the link", () => {
    const html = '<a href="/x"><img src="i.png" alt="Profile"></a>';
    expect(only(RULE, html)).toEqual([]);
  });

  it("fires vague-link-text for boilerplate phrases", () => {
    for (const phrase of ["click here", "read more", "here"]) {
      const findings = only(RULE, `<a href="/x">${phrase}</a>`);
      expect(findings.map((f) => f.rule)).toEqual(["vague-link-text"]);
    }
  });

  it("vague match is case-insensitive", () => {
    const findings = only(RULE, '<a href="/x">Click Here</a>');
    expect(findings.map((f) => f.rule)).toEqual(["vague-link-text"]);
  });

  it("does not flag a link with no href at all (an anchor target, not a link)", () => {
    expect(only(RULE, '<a name="section"></a>')).toEqual([]);
  });

  it("descriptive link text is fine", () => {
    expect(only(RULE, '<a href="/x">Read the full pricing guide</a>')).toEqual([]);
  });
});

describe("heading-hierarchy-skip", () => {
  const RULE = "heading-hierarchy-skip";

  it("fires when a heading skips a level", () => {
    const findings = only(RULE, "<h1>a</h1><h3>b</h3>");
    expect(findings.map((f) => f.rule)).toEqual([RULE]);
    expect(findings[0]!.severity).toBe("warning");
  });

  it("does not fire for a step of exactly one level", () => {
    expect(only(RULE, "<h1>a</h1><h2>b</h2>")).toEqual([]);
  });

  it("does not fire when a heading level decreases", () => {
    expect(only(RULE, "<h1>a</h1><h2>b</h2><h1>c</h1>")).toEqual([]);
  });

  it("the first heading on the page is never a skip", () => {
    expect(only(RULE, "<h3>first heading</h3>")).toEqual([]);
  });

  it("flags every skip in a longer sequence", () => {
    const findings = only(RULE, "<h1>a</h1><h4>b</h4><h6>c</h6>");
    expect(findings).toHaveLength(2);
  });
});

describe("missing-lang", () => {
  const RULE = "missing-lang";

  it("fires when <html> has no lang attribute", () => {
    const findings = only(RULE, "<html><body>x</body></html>");
    expect(findings.map((f) => f.rule)).toEqual([RULE]);
  });

  it("fires when lang is present but empty", () => {
    const findings = only(RULE, '<html lang=""><body>x</body></html>');
    expect(findings.map((f) => f.rule)).toEqual([RULE]);
  });

  it("does not fire when lang is set", () => {
    expect(only(RULE, '<html lang="en"><body>x</body></html>')).toEqual([]);
  });

  it("does nothing when there is no <html> element at all", () => {
    expect(only(RULE, "<p>fragment, no html tag</p>")).toEqual([]);
  });
});

describe("keyboard-unreachable-interactive", () => {
  const RULE = "keyboard-unreachable-interactive";

  it("fires on a div with onclick and no keyboard affordance", () => {
    const findings = only(RULE, '<div onclick="go()">x</div>');
    expect(findings.map((f) => f.rule)).toEqual([RULE]);
  });

  it("is satisfied by role=button plus a non-negative tabindex", () => {
    const html = '<div onclick="go()" role="button" tabindex="0">x</div>';
    expect(only(RULE, html)).toEqual([]);
  });

  it("tabindex=-1 alone is not enough (not reachable by Tab)", () => {
    const html = '<div onclick="go()" role="button" tabindex="-1">x</div>';
    const findings = only(RULE, html);
    expect(findings.map((f) => f.rule)).toEqual([RULE]);
  });

  it("does not fire on real interactive elements", () => {
    expect(only(RULE, '<button onclick="go()">x</button>')).toEqual([]);
    expect(only(RULE, '<a href="/x" onclick="go()">x</a>')).toEqual([]);
  });

  it("does not fire on an element with no onclick", () => {
    expect(only(RULE, "<div>x</div>")).toEqual([]);
  });
});

describe("missing-title", () => {
  const RULE = "missing-title";

  it("fires when there is no <title> at all", () => {
    const findings = only(RULE, "<html><head></head></html>");
    expect(findings.map((f) => f.rule)).toEqual([RULE]);
  });

  it("fires when <title> is present but empty", () => {
    const findings = only(RULE, "<html><head><title></title></head></html>");
    expect(findings.map((f) => f.rule)).toEqual([RULE]);
  });

  it("does not fire when a real title is present", () => {
    expect(only(RULE, "<html><head><title>Home</title></head></html>")).toEqual([]);
  });
});

describe("table-missing-headers", () => {
  const RULE = "table-missing-headers";

  it("fires on a data table with no th cells", () => {
    const findings = only(RULE, "<table><tr><td>1</td></tr></table>");
    expect(findings.map((f) => f.rule)).toEqual([RULE]);
  });

  it("does not fire when th cells are present", () => {
    const html = "<table><tr><th>Name</th></tr><tr><td>Alice</td></tr></table>";
    expect(only(RULE, html)).toEqual([]);
  });

  it("does not fire on a table with no data rows at all (a layout table)", () => {
    expect(only(RULE, "<table></table>")).toEqual([]);
  });
});

describe("duplicate-id", () => {
  const RULE = "duplicate-id";

  it("fires when an id is reused", () => {
    const findings = only(RULE, '<div id="x"></div><div id="x"></div>');
    expect(findings.map((f) => f.rule)).toEqual([RULE]);
  });

  it("only the second (and later) occurrence is flagged", () => {
    const findings = only(RULE, '<div id="x"></div><div id="x"></div><div id="x"></div>');
    expect(findings).toHaveLength(2);
  });

  it("does not fire when every id is unique", () => {
    expect(only(RULE, '<div id="a"></div><div id="b"></div>')).toEqual([]);
  });

  it("does not fire on elements with no id", () => {
    expect(only(RULE, "<div></div><div></div>")).toEqual([]);
  });
});

describe("iframe-missing-title", () => {
  const RULE = "iframe-missing-title";

  it("fires on an iframe with no title", () => {
    const findings = only(RULE, '<iframe src="x"></iframe>');
    expect(findings.map((f) => f.rule)).toEqual([RULE]);
    expect(findings[0]!.severity).toBe("warning");
  });

  it("fires when title is present but blank", () => {
    const findings = only(RULE, '<iframe src="x" title="  "></iframe>');
    expect(findings.map((f) => f.rule)).toEqual([RULE]);
  });

  it("does not fire when a real title is present", () => {
    expect(only(RULE, '<iframe src="x" title="Payment form"></iframe>')).toEqual([]);
  });
});

describe("ordering and filtering", () => {
  it("errors sort before warnings, by document position within severity", () => {
    const html = '<iframe src="x" title="ok"></iframe><img src="a.png">';
    const findings = findingsFor(html, ["missing-alt", "iframe-missing-title"]);
    expect(findings.map((f) => f.rule)).toEqual(["missing-alt"]);
  });

  it("errors sort strictly before warnings across two firing rules", () => {
    const html = '<iframe src="x"></iframe><img src="a.png">';
    const findings = findingsFor(html, ["missing-alt", "iframe-missing-title"]);
    expect(findings.map((f) => f.rule)).toEqual(["missing-alt", "iframe-missing-title"]);
  });

  it("the only filter restricts which rules run", () => {
    const html = '<img src="a.png"><iframe src="x"></iframe>';
    const findings = findingsFor(html, ["missing-alt"]);
    expect(findings.map((f) => f.rule)).toEqual(["missing-alt"]);
  });

  it("an unknown rule name in only is silently ignored, not an error", () => {
    const html = '<img src="a.png">';
    expect(() => findingsFor(html, ["not-a-real-rule"])).not.toThrow();
  });
});
