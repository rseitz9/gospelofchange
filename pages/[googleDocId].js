import Head from "next/head";
import { getHTMLFromGoogleDocId } from "../lib/googledoc";
import { getPageMetadata } from "../lib/lib";
import Outline from "../components/Outline";
import Footer from "../components/Footer";
import ErrorNotPublished from "../components/ErrorNotPublished";
import ErrorInvalidDocId from "../components/ErrorInvalidDocId";
import RenderGoogleDoc from "../components/RenderGoogleDoc";
import sitemap from "../sitemap.json";
import { useEffect, useState } from "react";

const defaultValues = sitemap.index;

export async function getStaticPaths() {
  const paths = [];
  Object.keys(sitemap).forEach((key) => {
    if (key.match(/^collectives/)) return;
    paths.push({
      params: {
        googleDocId: sitemap[key].googleDocId,
      },
    });
    if (sitemap[key].aliases) {
      sitemap[key].aliases.map((alias) => {
        paths.push({
          params: {
            googleDocId: alias,
          },
        });
      });
    }
    paths.push({
      params: {
        googleDocId: key,
      },
    });
  });
  // console.log(paths);
  return {
    paths,
    fallback: true,
  };
}

export async function getStaticProps({ params }) {
  const pageInfo = getPageMetadata(params.googleDocId);
  const googleDocId = pageInfo.googleDocId || params.googleDocId;
  let doc = {},
    error = null;
  try {
    doc = await getHTMLFromGoogleDocId(googleDocId);
  } catch (e) {
    error = e.message;
  }

  doc = doc || {};

  const page = {
    title: pageInfo.title || doc.title || null,
    description: pageInfo.description || doc.description || null,
    image: pageInfo.image || null,
    body: doc.body || null,
    outline: doc.outline || null,
    googleDocId,
    error,
  };

  return {
    props: { page },
    // we will attempt to re-generate the page:
    // - when a request comes in
    // - at most once every 180 seconds
    revalidate: 180,
  };
}

export default function Home({ page }) {
  if (!page) return <div />;
  const { title, description, outline, body, image, googleDocId, error } = page;
  const [currentSection, setCurrentSection] = useState();
  const [currentDocWidth, setCurrentDocWidth] = useState(0);

  function changeCurrentSection(section) {
    setCurrentSection(section);
    document.querySelectorAll("#outline a").forEach((el) => {
      const href = el.getAttribute("href");
      if (href === `#${section}`) {
        el.classList.add("bg-gray-300");
        console.log(">>> adding active to", el);
      } else {
        el.classList.remove("bg-gray-300");
      }
    });
    console.log(">>> current section", section);
    history.replaceState(
      null,
      null,
      document.location.pathname + (section ? "#" + section : "")
    );
  }

  function logit() {
    const y = window.pageYOffset;
    if (y % 5 !== 0) return false;

    let section = null,
      index = 0;
    outline.forEach((item, i) => {
      if (y >= item.offsetTop - 60) {
        section = item.slug;
        index = i;
      }
    });
    if (section !== currentSection) {
      changeCurrentSection(section);
    }
  }

  function computeOffset() {
    const docEl = document.querySelector("#document");
    if (!docEl) return;
    if (Math.abs(docEl.offsetWidth - currentDocWidth) < 50) {
      return;
    }
    setCurrentDocWidth(Number(docEl.offsetWidth) || 120);
    docEl.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((el) => {
      const slug = el.getAttribute("id");
      const item = outline.find((o) => o.slug === slug);
      if (!item) return;
      item.offsetTop = el.offsetTop;
      item.el = el;
    });
  }

  useEffect(() => {
    // we only highlight the current section on large screens
    // where the outline is visible side by side
    if (window.innerWidth < 768) return false;

    function addListeners() {
      window.addEventListener("scroll", logit);
      window.addEventListener("resize", computeOffset);
    }
    computeOffset();
    addListeners();
    return () => {
      window.removeEventListener("scroll", logit);
      window.removeEventListener("resize", computeOffset);
    };
  });

  return (
    <div className="w-full">
      <Head>
        <title>{title || defaultValues.title}</title>
        <link rel="icon" href={defaultValues.favicon} />
        <meta
          name="description"
          content={description || defaultValues.description}
        />
        <meta name="og:image" content={image || defaultValues.image} />
      </Head>

      <main className="relative min-h-screen md:flex">
        {outline && (
          <Outline outline={outline} onChange={() => computeOffset()} />
        )}
        <div className="content px-4 mx-auto max-w-screen-md flex-1 overflow-auto">
          {!body && !error && <p>Loading...</p>}
          {error === "not_published" && (
            <ErrorNotPublished googleDocId={googleDocId} />
          )}
          {error === "invalid_googledocid" && (
            <ErrorInvalidDocId googleDocId={googleDocId} />
          )}
          {body && (
            <div id="document">
              <RenderGoogleDoc html={body} />
              <Footer googleDocId={googleDocId} />
            </div>
          )}
        </div>
        {/* make sure tailwind includes the .imageWrapper.fullWidth classes in production */}
        <span className="imageWrapper fullWidth"></span>
      </main>
    </div>
  );
}
