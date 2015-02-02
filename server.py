import os

from tornado.ioloop import IOLoop
import tornado.web

settings = {
    "autoreload": True,
    "cookie_secret": "2f98h98c198vh98h09sdf09sue09fj1092fvu98sd7v09u29fhaosc09zll2k00109sc652",
    "login_url": "/login",
    "static_path": os.path.join(os.path.dirname(__file__), "static"),
    "xsrf_cookies": True,
}

def make_app():
    return tornado.web.Application([
        (r"/()$", tornado.web.StaticFileHandler, {"path": os.path.join(settings["static_path"], "index.html")}),
        ], **settings)

def main():
    app = make_app()
    app.listen(8888)
    IOLoop.current().start()

main()
