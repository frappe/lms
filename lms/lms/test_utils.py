import unittest
from .utils import slugify

class TestSlugify(unittest.TestCase):
    def test_simple(self):
        self.assertEquals(slugify("hello-world"), "hello-world")
        self.assertEquals(slugify("Hello World"), "hello-world")
        self.assertEquals(slugify("Hello, World!"), "hello-world")

    def test_duplicates(self):
        self.assertEquals(
            slugify("Hello World", ['hello-world']),
            "hello-world-2")

        self.assertEquals(
            slugify("Hello World", ['hello-world', 'hello-world-2']),
            "hello-world-3")
